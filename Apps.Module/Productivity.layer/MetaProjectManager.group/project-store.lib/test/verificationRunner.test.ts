const { test } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")
const { EventEmitter } = require("events") as typeof import("events")

const { CreateVerificationRunner, BuildVerificationRunner } = require("../src/Utils/verificationRunner")

// Terminal falso: emite o que um terminal real emitiria, no próximo tick.
const FakeStream = (mensagens: any[]) => {
    const ee: any = new EventEmitter()
    ee.close = () => { ee.fechado = true }
    setImmediate(() => { for(const m of mensagens) ee.emit("message", JSON.stringify(m)) })
    return ee
}

const FakeClient = ({ resposta, stream, aoAbrir }: any = {}) => ({
    RunCommand: async () => resposta,
    OpenTerminalStream: async () => { aoAbrir && aoAbrir(); return stream },
    KillTerminal: async () => undefined
})

test("captura saída e código de saída do terminal", async () => {
    const run = CreateVerificationRunner({
        instanceManagerClient: FakeClient({
            resposta: { terminalId: "t-1" },
            stream: FakeStream([
                { type: "data", data: "142 passed\n" },
                { type: "exit", exitCode: 0 }
            ])
        })
    })
    const r = await run({ command: "node", args: ["--test"], cwd: "/tmp" })
    assert.equal(r.exitCode, 0)
    assert.match(r.output, /142 passed/)
    assert.ok(r.durationMs >= 0)
})

test("comando que falha é RESULTADO, não erro", async () => {
    const run = CreateVerificationRunner({
        instanceManagerClient: FakeClient({
            resposta: { terminalId: "t-2" },
            stream: FakeStream([{ type: "data", data: "1 failing\n" }, { type: "exit", exitCode: 3 }])
        })
    })
    const r = await run({ command: "node", cwd: "/tmp" })
    assert.equal(r.exitCode, 3)
    assert.match(r.output, /1 failing/)
    assert.ok(!r.error, "exit != 0 não é erro do runner")
})

// A regressão que desligou a verificação inteira: OpenTerminalStream é async, e
// registrar os handlers na Promise em vez de no socket faz TODA verificação
// terminar em timeout com saída vazia — sem erro em lugar nenhum.
test("o stream é aguardado antes de assinar os eventos", async () => {
    let abriu = false
    const run = CreateVerificationRunner({
        instanceManagerClient: FakeClient({
            resposta: { terminalId: "t-3" },
            stream: FakeStream([{ type: "data", data: "ok\n" }, { type: "exit", exitCode: 0 }]),
            aoAbrir: () => { abriu = true }
        })
    })
    const r = await run({ command: "true", cwd: "/tmp", timeoutMs: 2000 })
    assert.ok(abriu)
    assert.equal(r.exitCode, 0, "sem o await isto seria null por timeout")
    assert.equal(r.timedOut, undefined)
})

test("aceita a resposta envelopada do daemon", async () => {
    const run = CreateVerificationRunner({
        instanceManagerClient: FakeClient({
            resposta: { data: { terminalId: "t-4" } },
            stream: FakeStream([{ type: "exit", exitCode: 0 }])
        })
    })
    assert.equal((await run({ command: "true", cwd: "/tmp" })).exitCode, 0)
})

test("sem terminalId não fica pendurado: devolve o motivo", async () => {
    const run = CreateVerificationRunner({ instanceManagerClient: FakeClient({ resposta: {} }) })
    const r = await run({ command: "true", cwd: "/tmp", timeoutMs: 500 })
    assert.equal(r.exitCode, null)
    assert.match(r.error, /não devolveu um terminal/)
})

test("canal sem superfície de eventos não vira timeout silencioso", async () => {
    const run = CreateVerificationRunner({
        instanceManagerClient: FakeClient({ resposta: { terminalId: "t-5" }, stream: {} })
    })
    const r = await run({ command: "true", cwd: "/tmp", timeoutMs: 500 })
    assert.equal(r.exitCode, null)
    assert.match(r.error, /sem superfície de eventos/)
})

test("terminal que fecha sem exit não é lido como sucesso", async () => {
    const ee: any = new EventEmitter()
    ee.close = () => undefined
    setImmediate(() => ee.emit("close"))
    const run = CreateVerificationRunner({
        instanceManagerClient: FakeClient({ resposta: { terminalId: "t-6" }, stream: ee })
    })
    const r = await run({ command: "true", cwd: "/tmp", timeoutMs: 1000 })
    assert.equal(r.exitCode, null, "silêncio nunca vira exitCode 0")
    assert.match(r.error, /sem informar o código de saída/)
})

test("estourar o tempo mata o processo e devolve o que saiu", async () => {
    const ee: any = new EventEmitter()
    ee.close = () => undefined
    setImmediate(() => ee.emit("message", JSON.stringify({ type: "data", data: "compilando…" })))
    let matou: any
    const run = CreateVerificationRunner({
        instanceManagerClient: {
            RunCommand: async () => ({ terminalId: "t-7" }),
            OpenTerminalStream: async () => ee,
            KillTerminal: async ({ terminalId }: any) => { matou = terminalId }
        }
    })
    const r = await run({ command: "sleep", cwd: "/tmp", timeoutMs: 120 })
    assert.equal(r.timedOut, true)
    assert.equal(matou, "t-7", "não deixa processo órfão segurando recurso")
    assert.match(r.output, /compilando/, "devolve o que já tinha saído")
})

// A montagem é única para os três hosts justamente porque cada um errava de um
// jeito diferente. Errar agora precisa DIZER o motivo, não devolver undefined mudo.
test("montagem indisponível informa o motivo em vez de sumir", () => {
    const motivos: any[] = []
    const onUnavailable = (m: any) => motivos.push(m)

    assert.equal(BuildVerificationRunner({ onUnavailable }), undefined)
    assert.match(motivos[0], /não foi injetada/)

    assert.equal(BuildVerificationRunner({ instanceManagerClientLib: {}, onUnavailable }), undefined)
    assert.match(motivos[1], /nem o caminho do socket/)

    const libQueQuebra = { require: () => () => { throw new Error("daemon fora do ar") } }
    assert.equal(BuildVerificationRunner({
        instanceManagerClientLib: libQueQuebra, ecosystemDataPath: "/tmp/eco", onUnavailable
    }), undefined)
    assert.match(motivos[2], /daemon fora do ar/)
    assert.match(motivos[2], /ecosystem-instance-manager\.app\.sock/, "o caminho tentado aparece no motivo")
})

test("o socket é derivado do EcosystemData com o nome de parâmetro que a lib espera", () => {
    let recebido: any
    const lib = { require: () => (args: any) => { recebido = args; return { RunCommand: async () => ({}) } } }
    const runner = BuildVerificationRunner({ instanceManagerClientLib: lib, ecosystemDataPath: "/opt/eco" })
    assert.equal(typeof runner, "function")
    assert.equal(recebido.platformApplicationSocketPath, "/opt/eco/sockets/ecosystem-instance-manager.app.sock")
})

test("o til do startup-param é expandido: um socket com ~ não existe", () => {
    let recebido: any
    const lib = { require: () => (args: any) => { recebido = args; return { RunCommand: async () => ({}) } } }
    BuildVerificationRunner({ instanceManagerClientLib: lib, ecosystemDataPath: "~/EcosystemData" })
    assert.ok(!recebido.platformApplicationSocketPath.includes("~"))
    assert.ok(recebido.platformApplicationSocketPath.startsWith(require("os").homedir()))
})

test("socket explícito tem precedência sobre o derivado", () => {
    let recebido: any
    const lib = { require: () => (args: any) => { recebido = args; return { RunCommand: async () => ({}) } } }
    BuildVerificationRunner({ instanceManagerClientLib: lib, ecosystemDataPath: "/opt/eco", socketPath: "/run/outro.sock" })
    assert.equal(recebido.platformApplicationSocketPath, "/run/outro.sock")
})
