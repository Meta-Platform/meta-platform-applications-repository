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

test("checklist add/update/remove + acceptance via API", async () => {
    const add = await srv.request("POST", `/items/${itemId}/checklist`, { text: "passo 1" })
    assert.equal(add.json.ok, true)
    const clId = add.json.data.id
    const upd = await srv.request("PATCH", `/checklist/${clId}`, { done: true })
    assert.equal(upd.json.data.done, true)
    const got = await srv.request("GET", `/items/${itemId}`)
    assert.ok(got.json.data.checklist.some((c) => c.id === clId && c.done))
    const rem = await srv.request("DELETE", `/checklist/${clId}`)
    assert.equal(rem.json.ok, true)
    const ac = await srv.request("POST", `/items/${itemId}/acceptance`, { text: "deve compilar" })
    assert.equal(ac.json.ok, true)
    const acUpd = await srv.request("PATCH", `/acceptance/${ac.json.data.id}`, { met: true })
    assert.equal(acUpd.json.data.met, true)
})

test("agente criar projeto via API bloqueia + aprovar executa", async () => {
    const blocked = await srv.request("POST", "/projects", { name: "API Agent Proj", sessionProvider: "claude", sessionModel: "claude-sonnet-4", sessionTrace: "WT-1", sessionHost: "remoteHost" })
    assert.equal(blocked.json.ok, false)
    assert.equal(blocked.json.code, "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const list = await srv.request("GET", "/creation-requests?type=project")
    const req = list.json.data.find((r) => r.payload.name === "API Agent Proj")
    assert.ok(req)
    assert.equal(req.session.host, "remoteHost")
    assert.equal(req.session.provider, "claude")
    const appr = await srv.request("POST", `/creation-requests/${req.id}/approve`, {})
    assert.equal(appr.json.ok, true)
    assert.equal(appr.json.data.result.slug, "api-agent-proj")
})

test("agente criar ITEM via API é livre (sem gate)", async () => {
    const it = await srv.request("POST", `/projects/${projectId}/items`, { type: "task", title: "AgentItem", sessionProvider: "claude", sessionModel: "claude-sonnet-4", sessionTrace: "WT-1" })
    assert.equal(it.json.ok, true)
    assert.ok(it.json.data.key)
})

test("milestone CRUD + roadmap + atribuição via API", async () => {
    const m = await srv.request("POST", `/projects/${projectId}/milestones`, { name: "Release API", targetDate: "2026-10-01" })
    assert.equal(m.json.ok, true)
    const mid = m.json.data.id
    await srv.request("POST", `/items/${itemId}/planning`, { milestone: mid })
    const got = await srv.request("GET", `/milestones/${mid}`)
    assert.ok(got.json.data.totalItems >= 1)
    const road = await srv.request("GET", `/projects/${projectId}/roadmap`)
    assert.ok(road.json.data.some((x) => x.id === mid && x.progress !== undefined))
    const sp = await srv.request("POST", `/projects/${projectId}/sprints`, { name: "Sprint API" })
    assert.equal(sp.json.data.status, "planned")
})

test("agente criar milestone via API bloqueia (gate)", async () => {
    const blk = await srv.request("POST", `/projects/${projectId}/milestones`, { name: "M Agente API", sessionProvider: "claude", sessionModel: "claude-sonnet-4", sessionTrace: "W-M" })
    assert.equal(blk.json.ok, false)
    assert.equal(blk.json.code, "AGENT_SESSION_CONFIRMATION_REQUIRED")
})

test("planejamento via API: tipo feature + horizon + filtro + horizon-board", async () => {
    const it = await srv.request("POST", `/projects/${projectId}/items`, { type: "feature", title: "CLI api", horizon: "next", value: "high", area: "CLI" })
    assert.equal(it.json.ok, true)
    assert.equal(it.json.data.type, "feature")
    assert.equal(it.json.data.horizon, "next")
    assert.equal(it.json.data.area, "CLI")
    const byH = await srv.request("GET", `/projects/${projectId}/items?horizon=next`)
    assert.ok(byH.json.data.some((i) => i.id === it.json.data.id))
    const hb = await srv.request("GET", `/projects/${projectId}/horizon-board`)
    assert.ok(hb.json.data.next.length >= 1)
})

test("GUI 1-7 backend: link/unlink, reorder, contexto de software", async () => {
    const a = await srv.request("POST", `/projects/${projectId}/items`, { type: "task", title: "A-link" })
    const bItem = await srv.request("POST", `/projects/${projectId}/items`, { type: "task", title: "B-link" })
    const link = await srv.request("POST", `/items/${a.json.data.id}/links`, { relation: "blocks", target: bItem.json.data.key })
    assert.equal(link.json.ok, true)
    const unlink = await srv.request("POST", `/items/${a.json.data.id}/unlink`, { relation: "blocks", target: bItem.json.data.key })
    assert.equal(unlink.json.data.removed, 1)
    const reorder = await srv.request("POST", `/items/${a.json.data.id}/reorder`, { order: 3 })
    assert.equal(reorder.json.data.order, 3)
    const upd = await srv.request("PATCH", `/items/${a.json.data.id}`, { branchName: "feat/x", commitHash: "abc", environment: "dev", moduleName: "Apps.Module" })
    assert.equal(upd.json.data.branchName, "feat/x")
    assert.equal(upd.json.data.environment, "dev")
})

test("GUI 3: anexo associado a comentário (commentId via API)", async () => {
    const c = await srv.request("POST", `/items/${itemId}/comments`, { body: "com anexo" })
    const att = await srv.request("POST", `/items/${itemId}/attachments`, { name: "n.txt", base64: Buffer.from("x").toString("base64"), commentId: c.json.data.id })
    assert.equal(att.json.data.commentId, c.json.data.id)
    // #16: conteúdo base64 para download via IPC no desktop
    const content = await srv.request("GET", `/attachments/${att.json.data.id}/content`)
    assert.equal(content.json.ok, true)
    assert.equal(Buffer.from(content.json.data.base64, "base64").toString(), "x")
})

test("GUI 6-7: export projeto + app-state", async () => {
    const exp = await srv.request("GET", `/projects/${projectId}/export`)
    assert.equal(exp.json.ok, true)
    assert.ok(exp.json.data.items.length >= 1)
    const set = await srv.request("POST", "/app-state/lastProject", { value: { id: projectId, view: "board" } })
    assert.equal(set.json.ok, true)
    const get = await srv.request("GET", "/app-state/lastProject")
    assert.equal(get.json.data.value.view, "board")
})

test("erro estruturado 200 com ok:false em NOT_FOUND", async () => {
    const { json } = await srv.request("GET", "/items/MP-999")
    assert.equal(json.ok, false)
    assert.equal(json.code, "NOT_FOUND")
})
