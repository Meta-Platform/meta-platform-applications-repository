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
