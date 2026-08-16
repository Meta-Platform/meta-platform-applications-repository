const { test, before } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")
const os = require("os") as typeof import("os"); const path = require("path") as typeof import("path"); const fs = require("fs") as typeof import("fs")

const InitializeProjectStore = require("../../project-store.lib/src/InitializeProjectStore")
const { BuildTools } = require("../src/Server/Tools")
const { CreateMcpStdioServer } = require("../src/Server/McpStdioServer")

// O AVISO VIAJA NA RESPOSTA (MPMX3-16/19).
//
// Uma tool de descoberta só serve a quem já desconfia que precisa perguntar —
// e o agente que causa o estrago é justamente o que não sabe. Por isso o aviso
// (entrou/saiu alguém, chegou recado, mexeram no ambiente) vai no envelope de
// TODA resposta, fora de `data`. Estes testes travam esse contrato.

const TMP = path.join(os.tmpdir(), `mpm-notices-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })

const actor = { source: "agent", session: { provider: "claude", model: "claude-opus-5", traceId: "NOT-EU" } }
const outra = { source: "agent", session: { provider: "codex", model: "gpt-6", traceId: "NOT-OUTRA" } }

let store: any, server: any
const sent: string[] = []

// Captura o que o servidor escreveria no stdout do protocolo. Só o JSON-RPC é
// desviado: o resto (relatório do próprio test runner) segue para o terminal,
// senão o teste engole a própria saída.
const withCapturedStdout = async (run: () => any) => {
    const original = process.stdout.write
    process.stdout.write = function(chunk: any, ...rest: any[]){
        const text = String(chunk)
        if(text.startsWith("{\"jsonrpc\"")){ sent.push(text); return true }
        return (original as any).call(process.stdout, chunk, ...rest)
    } as any
    try { await run() } finally { process.stdout.write = original }
}
const lastPayload = () => JSON.parse(JSON.parse(sent[sent.length - 1]).result.content[0].text)

before(async () => {
    store = InitializeProjectStore({ storage: path.join(TMP, "s.sqlite"), attachmentsDirPath: path.join(TMP, "att") })
    await store.ConnectAndSync()
    await store.CreateProject({ name: "Avisos", keyPrefix: "AVI", status: "active", actor: { source: "cli" } })
    server = CreateMcpStdioServer({
        name: "test", version: "0.0.1",
        tools: BuildTools({ store, actor }),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        collectNotices: () => store.CollectNotices({ actor, limit: 10 }).catch(() => [])
    })
})

test("resposta de tool carrega _notices quando há aviso novo", async () => {
    // A minha sessão precisa existir para ter cursor de leitura.
    await store.ResolveOrCreateSessionByIdentity(actor.session, "test")
    const vizinha = await store.ResolveOrCreateSessionByIdentity(outra.session, "test")

    // Outra sessão entra em cena depois de mim: é isso que eu preciso saber.
    await store.AnnounceArrival({ session: await store.models.AgentSession.findOne({ where: { id: vizinha.id } }) })

    await withCapturedStdout(() =>
        server.Dispatch({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_projects", arguments: {} } }))

    const payload = lastPayload()
    assert.equal(payload.ok, true)
    assert.ok(payload.data, "o dado da tool continua intacto")
    assert.ok(Array.isArray(payload._notices), "o aviso vem FORA de data")
    assert.ok(payload._notices.some((n: string) => /gpt-6/.test(n)), "e diz quem entrou")
})

test("aviso entregue não se repete na chamada seguinte", async () => {
    await withCapturedStdout(() =>
        server.Dispatch({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_projects", arguments: {} } }))
    assert.equal(lastPayload()._notices, undefined, "sem aviso novo, o envelope não muda")
})

test("o aviso viaja também quando a tool falha", async () => {
    await store.SendSessionMessage({ toSession: (await store.FindSessionByIdentity(actor.session)).id, body: "cuidado com o orquestrador", actor: outra })

    await withCapturedStdout(() =>
        server.Dispatch({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_item", arguments: { item: "NAO-EXISTE-1" } } }))

    const reply = JSON.parse(sent[sent.length - 1])
    assert.equal(reply.result.isError, true)
    const body = JSON.parse(reply.result.content[0].text)
    assert.equal(body.ok, false)
    assert.ok(body._notices.some((n: string) => /cuidado com o orquestrador/.test(n)), "o erro não engole o recado")
})
