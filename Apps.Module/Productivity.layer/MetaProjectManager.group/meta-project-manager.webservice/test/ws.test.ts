const { test, before, after } = require("node:test") as typeof import("node:test")
const assert = require("node:assert") as typeof import("node:assert")
const os = require("os") as typeof import("os")
const path = require("path") as typeof import("path")
const fs = require("fs") as typeof import("fs")

const MakeServer = require("./ws.harness")

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-ws-${process.pid}`)
fs.mkdirSync(TMP, { recursive: true })
const startupParams = {
    MPM_DB_FILE_PATH: path.join(TMP, "ws.sqlite"),
    MPM_ATTACHMENTS_DIR_PATH: path.join(TMP, "attachments"),
    MPM_MAX_ATTACHMENT_BYTES: 52428800
}

let srv: any
let projectId: any, boardId: any, itemId: any
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
    assert.ok(json.data.events.some((e: any) => e.type === "item.created"))
    assert.ok(json.data.cursor > 0)
})

test("checklist add/update/remove + acceptance via API", async () => {
    const add = await srv.request("POST", `/items/${itemId}/checklist`, { text: "passo 1" })
    assert.equal(add.json.ok, true)
    const clId = add.json.data.id
    const upd = await srv.request("PATCH", `/checklist/${clId}`, { done: true })
    assert.equal(upd.json.data.done, true)
    const got = await srv.request("GET", `/items/${itemId}`)
    assert.ok(got.json.data.checklist.some((c: any) => c.id === clId && c.done))
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
    const req = list.json.data.find((r: any) => r.payload.name === "API Agent Proj")
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
    assert.ok(road.json.data.some((x: any) => x.id === mid && x.progress !== undefined))
    const sp = await srv.request("POST", `/projects/${projectId}/sprints`, { name: "Sprint API" })
    assert.equal(sp.json.data.status, "planned")
})

// Criar milestone é planejamento reversível: livre para agentes. O gate está no delete.
test("agente criar milestone via API é livre (sem gate)", async () => {
    const m = await srv.request("POST", `/projects/${projectId}/milestones`, { name: "M Agente API", sessionProvider: "claude", sessionModel: "claude-sonnet-4", sessionTrace: "W-M" })
    assert.equal(m.json.ok, true)
    assert.equal(m.json.data.name, "M Agente API")
})

test("planejamento via API: tipo feature + horizon + filtro + horizon-board", async () => {
    const it = await srv.request("POST", `/projects/${projectId}/items`, { type: "feature", title: "CLI api", horizon: "next", value: "high", area: "CLI" })
    assert.equal(it.json.ok, true)
    assert.equal(it.json.data.type, "feature")
    assert.equal(it.json.data.horizon, "next")
    assert.equal(it.json.data.area, "CLI")
    const byH = await srv.request("GET", `/projects/${projectId}/items?horizon=next`)
    assert.ok(byH.json.data.some((i: any) => i.id === it.json.data.id))
    const hb = await srv.request("GET", `/projects/${projectId}/horizon-board`)
    assert.ok(hb.json.data.next.length >= 1)
})

test("documentação via API: criar página/sub-página, listar, editar, mover, excluir", async () => {
    const root = await srv.request("POST", `/projects/${projectId}/doc-pages`, { title: "Guia", body: "# Guia" })
    assert.equal(root.json.ok, true)
    assert.equal(root.json.data.parentId, null)
    const sub = await srv.request("POST", `/projects/${projectId}/doc-pages`, { parentId: root.json.data.id, title: "Setup" })
    assert.equal(sub.json.data.parentId, root.json.data.id)

    const list = await srv.request("GET", `/projects/${projectId}/doc-pages`)
    assert.ok(list.json.data.length >= 2)

    const got = await srv.request("GET", `/doc-pages/${root.json.data.id}`)
    assert.equal(got.json.data.body, "# Guia")

    const upd = await srv.request("PATCH", `/doc-pages/${sub.json.data.id}`, { body: "passos", title: "Setup e instalação" })
    assert.equal(upd.json.data.body, "passos")

    const moved = await srv.request("POST", `/doc-pages/${sub.json.data.id}/move`, { parentId: "none" })
    assert.equal(moved.json.data.parentId, null)

    const del = await srv.request("DELETE", `/doc-pages/${root.json.data.id}`)
    assert.equal(del.json.data.deleted, true)
})

test("anexos de página via API: upload/link/list, ler conteúdo base64 e remover", async () => {
    const page = await srv.request("POST", `/projects/${projectId}/doc-pages`, { title: "Página com anexos" })
    const pageId = page.json.data.id

    // Upload (base64) — imagem SVG com MIME preservado.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    const up = await srv.request("POST", `/doc-pages/${pageId}/attachments`, { name: "icone.svg", base64: svg.toString("base64"), mimeType: "image/svg+xml" })
    assert.equal(up.json.ok, true)
    assert.equal(up.json.data.docPageId, pageId)
    assert.equal(up.json.data.type, "image")
    const attId = up.json.data.id

    // Link.
    const link = await srv.request("POST", `/doc-pages/${pageId}/attachments`, { url: "https://example.com/spec", name: "spec" })
    assert.equal(link.json.data.type, "link")

    // List traz os dois.
    const list = await srv.request("GET", `/doc-pages/${pageId}/attachments`)
    assert.equal(list.json.data.length, 2)

    // Conteúdo base64 (usado por preview/download no desktop).
    const content = await srv.request("GET", `/doc-attachments/${attId}/content`)
    assert.equal(content.json.ok, true)
    assert.equal(Buffer.from(content.json.data.base64, "base64").toString(), svg.toString())

    // Remover.
    const del = await srv.request("DELETE", `/doc-attachments/${attId}`)
    assert.equal(del.json.data.deleted, true)
    const after = await srv.request("GET", `/doc-pages/${pageId}/attachments`)
    assert.equal(after.json.data.length, 1)
})

test("export da documentação via API: HTML e .zip (base64)", async () => {
    await srv.request("POST", `/projects/${projectId}/doc-pages`, { title: "Export API", body: "# Oi\n\ntexto" })
    const html = await srv.request("GET", `/projects/${projectId}/docs/export/html`)
    assert.equal(html.json.ok, true)
    assert.match(html.json.data.filename, /\.html$/)
    assert.ok(html.json.data.html.includes("Sumário"))

    const arc = await srv.request("GET", `/projects/${projectId}/docs/export/archive`)
    assert.equal(arc.json.ok, true)
    assert.match(arc.json.data.filename, /\.zip$/)
    const zip = Buffer.from(arc.json.data.base64, "base64")
    assert.equal(zip.readUInt32LE(0), 0x04034b50)   // assinatura de zip
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

test("MPMR modelo de entrega ponta a ponta por HTTP", async () => {
    // Migrar é ação humana e devolve o que mudou.
    const proj = await srv.request("POST", "/projects", { name: "Entrega HTTP", keyPrefix: "EHT", status: "active" })
    const pid = proj.json.data.id
    const mig = await srv.request("POST", `/projects/${pid}/delivery-model`, {})
    assert.equal(mig.json.ok, true)
    assert.equal(mig.json.data.deliveryModel, true)

    const item = await srv.request("POST", `/projects/${pid}/items`, { type: "task", title: "Fazer algo" })
    const iid = item.json.data.id

    // Entregar (aqui sem sessão de agente: o webservice é o caminho humano/GUI).
    const ent = await srv.request("POST", `/items/${iid}/deliveries`, { summary: "Feito e verificado." })
    assert.equal(ent.json.ok, true)
    assert.equal(ent.json.data.round, 1)
    const did = ent.json.data.id

    // A Mesa mostra a entrega — como "em revisão pela IA", não como decisão
    // pendente: ela ainda não é trabalho do humano, mas ele precisa saber que
    // existe (senão a Mesa parece dizer que nada aconteceu).
    const mesa = await srv.request("GET", `/review-desk?project=${pid}`)
    assert.equal(mesa.json.ok, true)
    assert.equal(mesa.json.data.counts.inAiReview, 1)
    assert.equal(mesa.json.data.counts.deliveries, 0)

    // O humano decide sem esperar o revisor: ele é a autoridade final.

    // Devolver SEM motivo é recusado: é o defeito que mais desperdiça trabalho.
    const semMotivo = await srv.request("POST", `/deliveries/${did}/return`, {})
    assert.equal(semMotivo.json.ok, false)
    assert.equal(semMotivo.json.code, "VALIDATION_ERROR")

    const devolvida = await srv.request("POST", `/deliveries/${did}/return`, { reason: "faltou o teste" })
    assert.equal(devolvida.json.ok, true)

    // Reentrega e aceite.
    const ent2 = await srv.request("POST", `/items/${iid}/deliveries`, { summary: "Agora com teste." })
    assert.equal(ent2.json.data.round, 2)
    const aceita = await srv.request("POST", `/deliveries/${ent2.json.data.id}/accept`, {})
    assert.equal(aceita.json.data.status, "accepted")

    const final = await srv.request("GET", `/items/${iid}`)
    assert.equal(final.json.data.statusKey, "done")
    assert.equal(final.json.data.reviewState, "accepted")

    // Mandato pelo mesmo caminho.
    const man = await srv.request("POST", `/projects/${pid}/mandates`, { title: "Rodada HTTP", maxUnreviewedDeliveries: 2 })
    assert.equal(man.json.data.status, "active")
    const lista = await srv.request("GET", `/projects/${pid}/mandates`)
    assert.equal(lista.json.data.length, 1)
})

test("MPMR-33 o aviso ao desktop nunca derruba a operação que o originou", async () => {
    const { CreateDesktopNotifier, NotifiableEvent } = require("../src/Utils/notifyDesktop")

    // Sem URL configurada: vira no-op silencioso (desligar o aviso não pode
    // quebrar nada).
    const desligado = CreateDesktopNotifier({})
    assert.doesNotThrow(() => desligado({ title: "x" }))

    // Com URL para um endereço que NÃO responde: o erro de rede morre dentro.
    // É o caso real de um desktop fechado, e a entrega que acabou de ser feita
    // não pode falhar por causa disso.
    const morto = CreateDesktopNotifier({ url: "http://127.0.0.1:59999/notify", timeoutMs: 100 })
    assert.doesNotThrow(() => morto({ title: "Entrega esperando revisão", body: "EHT-1/D1" }))
    // Espera o socket falhar de fato, para provar que o erro não sobe como
    // rejeição não tratada.
    await new Promise((r) => setTimeout(r, 300))

    // O que vira aviso, e o que NÃO vira — avisar sobre tudo treina a pessoa a
    // ignorar a notificação inteira.
    assert.ok(NotifiableEvent({ type: "delivery.awaiting_human", payload: { id: "d1", key: "X-1/D1", title: "t" } }))
    assert.ok(NotifiableEvent({ type: "mandate.exhausted", payload: { id: "m1", title: "Rodada", stopReason: "unreviewed-limit" } }))
    assert.ok(NotifiableEvent({ type: "approval.requested", payload: { request: { id: "r1" }, actionName: "delete", type: "item" } }))
    for(const ruido of ["item.updated", "audit.created", "delivery.submitted", "project.updated"])
        assert.equal(NotifiableEvent({ type: ruido, payload: { id: "x" } }), undefined,
            `${ruido} não deveria virar notificação`)

    // Cada aviso carrega dedupeKey: o mesmo fato anunciado duas vezes não
    // aparece duas vezes na tela.
    const aviso = NotifiableEvent({ type: "delivery.awaiting_human", payload: { id: "d9", key: "X-9/D1" } })
    assert.ok(aviso.dedupeKey && aviso.dedupeKey.includes("d9"))
})
