const { test, before, after } = require("node:test")
const assert = require("node:assert")
const os = require("os")
const path = require("path")
const fs = require("fs")

const MakeServer = require("./ws.harness")

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-ws-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })
const startupParams = {
    MPM_DB_FILE_PATH: path.join(TMP, "ws.sqlite"),
    MPM_ATTACHMENTS_DIR_PATH: path.join(TMP, "attachments"),
    MPM_MAX_ATTACHMENT_BYTES: 52428800
}

let srv
let projectId, boardId, itemId
before(async () => { srv = MakeServer({ startupParams }); await srv.listen() })
after(async () => { await srv.close() })

test("GET /health", async () => {
    const { json } = await srv.request("GET", "/health")
    assert.equal(json.ok, true)
    assert.equal(json.status, "ok")
})

test("POST /projects + GET /projects", async () => {
    const create = await srv.request("POST", "/projects", { name: "Meta Platform", description: "x" })
    assert.equal(create.json.ok, true)
    projectId = create.json.data.id
    const list = await srv.request("GET", "/projects")
    assert.equal(list.json.ok, true)
    assert.ok(list.json.data.length >= 1)
})

test("GET /projects/:id (arg posicional) resolve por slug", async () => {
    const { json } = await srv.request("GET", "/projects/meta-platform")
    assert.equal(json.ok, true)
    assert.equal(json.data.keyPrefix, "MP")
})

test("POST /projects/:id/boards + GET /boards/:id com colunas", async () => {
    const b = await srv.request("POST", `/projects/${projectId}/boards`, { name: "Development" })
    assert.equal(b.json.ok, true)
    boardId = b.json.data.id
    const got = await srv.request("GET", `/boards/${boardId}`)
    assert.equal(got.json.data.columns.length, 7)
})

test("POST /projects/:id/items + GET /items/:id", async () => {
    const it = await srv.request("POST", `/projects/${projectId}/items`, { type: "story", title: "Organizar" })
    assert.equal(it.json.ok, true)
    assert.equal(it.json.data.key, "MP-1")
    itemId = it.json.data.id
    const got = await srv.request("GET", `/items/${itemId}`)
    assert.equal(got.json.data.title, "Organizar")
})

test("POST /items/:id/status muda status", async () => {
    const { json } = await srv.request("POST", `/items/${itemId}/status`, { status: "in-progress" })
    assert.equal(json.ok, true)
    assert.equal(json.data.statusKey, "in-progress")
})

test("comentário + anexo base64", async () => {
    const c = await srv.request("POST", `/items/${itemId}/comments`, { body: "oi" })
    assert.equal(c.json.ok, true)
    const a = await srv.request("POST", `/items/${itemId}/attachments`, { name: "n.txt", base64: Buffer.from("hello").toString("base64"), mimeType: "text/plain" })
    assert.equal(a.json.ok, true)
    assert.ok(a.json.data.sha256)
})

test("usuário + agente + sessão via API", async () => {
    await srv.request("POST", "/users", { type: "human", name: "Kaio", handle: "kaio" })
    const ag = await srv.request("POST", "/agents", { provider: "claude", owner: "kaio", name: "Claude", handle: "claude-kaio", defaultModel: "claude-sonnet-4" })
    assert.equal(ag.json.ok, true)
    const agentId = ag.json.data.id
    const pend = await srv.request("POST", `/agents/${agentId}/sessions`, { model: "claude-sonnet-4" })
    assert.equal(pend.json.data.status, "pending_confirmation")
    const conf = await srv.request("POST", `/agent-sessions/${pend.json.data.id}/confirm`)
    assert.equal(conf.json.data.status, "active")
})

test("GET /activity e /reports/project-status", async () => {
    const act = await srv.request("GET", "/activity?project=MP")
    assert.equal(act.json.ok, true)
    assert.ok(act.json.data.length >= 1)
    const rep = await srv.request("GET", "/reports/project-status?project=MP")
    assert.equal(rep.json.ok, true)
    assert.ok(rep.json.data.total >= 1)
})

test("GET /events reflete mutações (buffer realtime)", async () => {
    const { json } = await srv.request("GET", "/events?since=0")
    assert.equal(json.ok, true)
    assert.ok(json.data.events.some((e) => e.type === "item.created"))
    assert.ok(json.data.cursor > 0)
})

test("erro estruturado 200 com ok:false em NOT_FOUND", async () => {
    const { json } = await srv.request("GET", "/items/MP-999")
    assert.equal(json.ok, false)
    assert.equal(json.code, "NOT_FOUND")
})
