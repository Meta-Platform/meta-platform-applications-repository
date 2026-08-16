const { test, before } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")
const os = require("os") as typeof import("os")
const path = require("path") as typeof import("path")
const fs = require("fs") as typeof import("fs")

const MakeHarness = require("./cli.harness")

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-cli-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })
const startupParams = {
    PKG_CONF_DIRNAME_METADATA: "metadata",
    MPM_DB_FILE_PATH: path.join(TMP, "cli.sqlite"),
    MPM_ATTACHMENTS_DIR_PATH: path.join(TMP, "attachments"),
    MPM_MAX_ATTACHMENT_BYTES: 52428800
}

let h: any
let sessionId: any
before(() => { h = MakeHarness({ startupParams }) })

test("project create --json retorna ok + key", async () => {
    const { json } = await h.run(["project", "create", "Meta Platform", "--json", "--description", "Gestão"])
    assert.equal(json.ok, true)
    assert.equal(json.data.slug, "meta-platform")
    assert.equal(json.data.keyPrefix, "MP")
})

test("board create --json", async () => {
    const { json } = await h.run(["board", "create", "--project", "meta-platform", "--name", "Development", "--json"])
    assert.equal(json.ok, true)
    assert.ok(json.data.id)
})

test("story e task create com parent", async () => {
    const s = await h.run(["story", "create", "--project", "MP", "--title", "Organizar projetos", "--json"])
    assert.equal(s.json.data.key, "MP-1")
    const t = await h.run(["task", "create", "--project", "MP", "--title", "Tela board", "--parent", "MP-1", "--json"])
    assert.equal(t.json.data.key, "MP-2")
})

test("user + agent create", async () => {
    await h.run(["user", "create", "--type", "human", "--name", "Kaio", "--handle", "kaio", "--json"])
    const a = await h.run(["agent", "create", "--provider", "claude", "--owner", "kaio", "--name", "Claude / Kaio", "--handle", "claude-kaio", "--default-model", "claude-sonnet-4", "--json"])
    assert.equal(a.json.ok, true)
    assert.equal(a.json.data.provider, "claude")
})

test("agent session register SEM --confirm => AGENT_SESSION_CONFIRMATION_REQUIRED", async () => {
    const { json } = await h.run(["agent", "session", "register", "--agent", "claude-kaio", "--model", "claude-sonnet-4", "--description", "impl", "--json"])
    assert.equal(json.ok, false)
    assert.equal(json.code, "AGENT_SESSION_CONFIRMATION_REQUIRED")
    assert.ok(json.pendingSessionId)
    assert.ok(Array.isArray(json.nextCommands))
})

test("agent session register --confirm => active", async () => {
    const { json } = await h.run(["agent", "session", "register", "--agent", "claude-kaio", "--model", "claude-sonnet-4", "--confirm", "--json"])
    assert.equal(json.ok, true)
    assert.equal(json.data.status, "active")
    sessionId = json.data.id
})

test("item set-status com --actor-session-id gera auditoria de agente", async () => {
    const { json } = await h.run(["item", "set-status", "MP-2", "--status", "in-progress", "--actor-session-id", sessionId, "--json"])
    assert.equal(json.ok, true)
    assert.equal(json.data.statusKey, "in-progress")
    const act = await h.run(["activity", "list", "--project", "MP", "--json"])
    assert.ok(act.json.data.some((e: any) => e.source === "agent" && e.action === "set-status"))
})

test("comment add", async () => {
    const { json } = await h.run(["comment", "add", "MP-2", "--body", "Iniciado", "--actor-session-id", sessionId, "--json"])
    assert.equal(json.ok, true)
})

test("attachment add arquivo local", async () => {
    const f = path.join(TMP, "log.txt"); fs.writeFileSync(f, "abc")
    const { json } = await h.run(["attachment", "add", "MP-2", "--file", f, "--description", "log", "--json"])
    assert.equal(json.ok, true)
    assert.ok(json.data.sha256)
})

test("project delete SEM --confirm => CONFIRMATION_REQUIRED", async () => {
    const { json } = await h.run(["project", "delete", "meta-platform", "--json"])
    assert.equal(json.ok, false)
    assert.equal(json.code, "CONFIRMATION_REQUIRED")
})

test("report project-status --json", async () => {
    const { json } = await h.run(["report", "project-status", "--project", "MP", "--json"])
    assert.equal(json.ok, true)
    assert.ok(json.data.total >= 2)
})

test("erro estruturado em item inexistente", async () => {
    const { json } = await h.run(["item", "show", "MP-999", "--json"])
    assert.equal(json.ok, false)
    assert.equal(json.code, "NOT_FOUND")
})

test("agente delete --no-wait vira pedido pendente; approve executa soft delete", async () => {
    const it = await h.run(["task", "create", "--project", "MP", "--title", "Alvo do agente", "--json"])
    const key = it.json.data.key
    // agente pede delete: gate bloqueia (--no-wait retorna o pendingCreationId sem esperar)
    const del = await h.run(["item", "delete", key, "--confirm", "--no-wait",
        "--session-provider", "claude", "--session-model", "claude-sonnet-4", "--session-trace", "T-DEL", "--json"])
    assert.equal(del.json.ok, false)
    assert.equal(del.json.code, "AGENT_SESSION_CONFIRMATION_REQUIRED")
    assert.equal(del.json.details.actionName, "delete")
    const reqId = del.json.details.pendingCreationId
    assert.ok(reqId)
    // item ainda existe
    const before = await h.run(["item", "show", key, "--json"])
    assert.equal(before.json.ok, true)
    // humano aprova pela CLI -> executa soft delete
    const appr = await h.run(["agent", "creation", "approve", reqId, "--json"])
    assert.equal(appr.json.ok, true)
    assert.equal(appr.json.data.result.deleted, true)
    // item some
    const after = await h.run(["item", "show", key, "--json"])
    assert.equal(after.json.ok, false)
    assert.equal(after.json.code, "NOT_FOUND")
})

test("rejeitar delete com --reason preserva o item", async () => {
    const it = await h.run(["task", "create", "--project", "MP", "--title", "Preservar", "--json"])
    const key = it.json.data.key
    const del = await h.run(["item", "delete", key, "--confirm", "--no-wait",
        "--session-provider", "claude", "--session-model", "claude-sonnet-4", "--session-trace", "T-DEL2", "--json"])
    const reqId = del.json.details.pendingCreationId
    const rej = await h.run(["agent", "creation", "reject", reqId, "--reason", "manter", "--json"])
    assert.equal(rej.json.ok, true)
    assert.equal(rej.json.data.status, "rejected")
    assert.equal(rej.json.data.rejectionReason, "manter")
    const show = await h.run(["item", "show", key, "--json"])
    assert.equal(show.json.ok, true)
})

test("project create --short-description persiste e aparece no show", async () => {
    const c = await h.run(["project", "create", "Com Curta", "--short-description", "Resumo em uma linha.", "--json"])
    assert.equal(c.json.ok, true)
    assert.equal(c.json.data.shortDescription, "Resumo em uma linha.")
    const s = await h.run(["project", "show", c.json.data.slug, "--json"])
    assert.equal(s.json.data.shortDescription, "Resumo em uma linha.")
})

test("activity note add atribui ao usuario-desktop e list devolve", async () => {
    const add = await h.run(["activity", "note", "add", "--item", "MP-1", "--text", "anotação manual", "--json"])
    assert.equal(add.json.ok, true)
    assert.equal(add.json.data.scopeType, "item")
    const list = await h.run(["activity", "note", "list", "--item", "MP-1", "--json"])
    assert.ok(list.json.data.some((n: any) => n.body === "anotação manual"))
})

test("audit list --project filtra por ação", async () => {
    const a = await h.run(["audit", "list", "--project", "MP", "--action", "set-status", "--json"])
    assert.equal(a.json.ok, true)
    assert.ok(a.json.data.every((e: any) => e.action === "set-status"))
})

test("activity list --provider filtra eventos de agente", async () => {
    const a = await h.run(["activity", "list", "--project", "MP", "--actor-type", "agent", "--json"])
    assert.equal(a.json.ok, true)
    assert.ok(a.json.data.every((e: any) => e.actorType === "agent"))
})

test("MPMR ciclo de entrega pela CLI: migrar, entregar, devolver, reentregar, aceitar", async () => {
    const proj = await h.run(["project", "create", "Entrega CLI", "--key-prefix", "ECL", "--status", "active", "--json"])
    const pid = proj.json.data.id
    const mig = await h.run(["project", "migrate-delivery", pid, "--json"])
    assert.equal(mig.json.ok, true)
    assert.equal(mig.json.data.deliveryModel, true)

    const item = await h.run(["item", "create", "--project", pid, "--type", "task", "--title", "Tarefa CLI", "--json"])
    const key = item.json.data.key

    const ent = await h.run(["delivery", "submit", key, "--summary", "Feito pela CLI.", "--json"])
    assert.equal(ent.json.ok, true)
    assert.equal(ent.json.data.round, 1)

    const lista = await h.run(["delivery", "list", "--project", pid, "--json"])
    assert.equal(lista.json.data.length, 1)

    // Devolver sem motivo não passa — é o que impede o agente de repetir o erro.
    const semMotivo = await h.run(["delivery", "return", ent.json.data.key, "--json"])
    assert.equal(semMotivo.json.ok, false)
    assert.equal(semMotivo.json.code, "VALIDATION_ERROR")

    const dev = await h.run(["delivery", "return", ent.json.data.key, "--reason", "faltou cobrir o caso vazio", "--json"])
    assert.equal(dev.json.ok, true)

    const ent2 = await h.run(["delivery", "submit", key, "--summary", "Caso vazio coberto.", "--json"])
    assert.equal(ent2.json.data.round, 2)
    const aceite = await h.run(["delivery", "accept", ent2.json.data.key, "--json"])
    assert.equal(aceite.json.data.status, "accepted")

    const final = await h.run(["item", "show", key, "--json"])
    assert.equal(final.json.data.statusKey, "done")
})

test("MPMR mesa de revisão e mandato pela CLI", async () => {
    const proj = await h.run(["project", "create", "Mesa CLI", "--key-prefix", "MCL", "--status", "active", "--json"])
    const pid = proj.json.data.id
    await h.run(["project", "migrate-delivery", pid, "--json"])

    const man = await h.run(["mandate", "create", "Rodada CLI", "--project", pid, "--max-unreviewed", "2", "--json"])
    assert.equal(man.json.data.status, "active")
    assert.equal(man.json.data.maxUnreviewedDeliveries, 2)

    const desk = await h.run(["review", "desk", "--project", pid, "--json"])
    assert.equal(desk.json.ok, true)
    assert.equal(typeof desk.json.data.counts.deliveries, "number")
})

// O bound-param de um .cli precisa ser declarado em TRÊS lugares: boot.json,
// `bound-params` do command-group E `parametersToLoad` do comando. Faltar no
// último não dá erro nenhum — o param chega undefined e o comando degrada em
// silêncio. Foi exatamente assim que `delivery submit` passou a produzir
// entregas com três lacunas e qualidade "unverified": parecia apurado e não era.
test("comandos que colhem evidência carregam as libs de coleta", () => {
    const grupo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "metadata", "command-group.json"), "utf8"))
    const boot = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "metadata", "boot.json"), "utf8"))

    const EXIGIDAS = ["projectStoreLib", "gitStatusLib", "instanceManagerClientLib"]
    const COLETAM = ["DeliverySubmit", "DeliveryRecollect"]

    for(const lib of EXIGIDAS){
        assert.ok(grupo["bound-params"].includes(lib), `${lib} ausente em bound-params do command-group`)
        for(const exe of boot.executables)
            assert.ok(exe["bound-params"][lib], `${lib} ausente no boot.json de ${exe.executableName}`)
    }

    const achar = (nodes: any[], ns: string): any => {
        for(const n of nodes){
            if(n.namespace === ns) return n
            const filho = n.children && achar(n.children, ns)
            if(filho) return filho
        }
    }
    for(const ns of COLETAM){
        const cmd = achar(grupo.commands, ns)
        assert.ok(cmd, `comando ${ns} não registrado`)
        for(const lib of EXIGIDAS)
            assert.ok((cmd.parametersToLoad || []).includes(lib),
                `${ns}.parametersToLoad não carrega ${lib} — o coletor chegaria undefined e a lacuna seria silenciosa`)
        // `cmd.path` vem do command-group SEM extensão (é assim que a plataforma
        // resolve). Aqui não há resolução de módulo para completá-la, então
        // procuramos o arquivo que existe — .ts hoje, .js enquanto sobrar algum.
        const base = path.join(__dirname, "..", "src", cmd.path)
        assert.ok([".ts", ".js"].some((ext: string) => fs.existsSync(base + ext)), `${cmd.path} não existe`)
    }
})
