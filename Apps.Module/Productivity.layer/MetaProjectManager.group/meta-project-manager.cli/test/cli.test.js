const { test, before } = require("node:test")
const assert = require("node:assert")
const os = require("os")
const path = require("path")
const fs = require("fs")

const MakeHarness = require("./cli.harness")

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-cli-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })
const startupParams = {
    PKG_CONF_DIRNAME_METADATA: "metadata",
    MPM_DB_FILE_PATH: path.join(TMP, "cli.sqlite"),
    MPM_ATTACHMENTS_DIR_PATH: path.join(TMP, "attachments"),
    MPM_MAX_ATTACHMENT_BYTES: 52428800
}

let h
let sessionId
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
    assert.ok(act.json.data.some((e) => e.source === "agent" && e.action === "set-status"))
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
    assert.ok(list.json.data.some((n) => n.body === "anotação manual"))
})

test("audit list --project filtra por ação", async () => {
    const a = await h.run(["audit", "list", "--project", "MP", "--action", "set-status", "--json"])
    assert.equal(a.json.ok, true)
    assert.ok(a.json.data.every((e) => e.action === "set-status"))
})

test("activity list --provider filtra eventos de agente", async () => {
    const a = await h.run(["activity", "list", "--project", "MP", "--actor-type", "agent", "--json"])
    assert.equal(a.json.ok, true)
    assert.ok(a.json.data.every((e) => e.actorType === "agent"))
})
