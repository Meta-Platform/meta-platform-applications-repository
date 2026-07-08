const { test, before } = require("node:test")
const assert = require("node:assert")
const os = require("os")
const path = require("path")
const fs = require("fs")

const InitializeProjectStore = require("../src/InitializeProjectStore")

const TMP = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-test-${process.pid}`)
const DB_PATH = path.join(TMP, "store.sqlite")
const ATT_DIR = path.join(TMP, "attachments")

let store
const events = []

before(async () => {
    fs.mkdirSync(TMP, { recursive: true })
    store = InitializeProjectStore({ storage: DB_PATH, attachmentsDirPath: ATT_DIR, onEvent: (e) => events.push(e) })
    await store.ConnectAndSync()
})

test("cria projeto e gera keyPrefix/slug", async () => {
    const p = await store.CreateProject({ name: "Meta Platform", description: "Gestão", actor: { source: "cli" } })
    assert.ok(p.id)
    assert.equal(p.slug, "meta-platform")
    assert.equal(p.keyPrefix, "MP")
})

test("slug duplicado gera CONFLICT", async () => {
    await assert.rejects(() => store.CreateProject({ name: "Meta Platform" }), (e) => e.code === "CONFLICT")
})

test("cria board com colunas padrão e vira default", async () => {
    const b = await store.CreateBoard({ project: "meta-platform", name: "Development" })
    const full = await store.GetBoard({ board: b.id })
    assert.equal(full.columns.length, 7)
    const proj = await store.GetProject({ project: "meta-platform" })
    assert.equal(proj.defaultBoardId, b.id)
})

test("cria história, tarefa e subtarefa com keys sequenciais", async () => {
    const story = await store.CreateItem({ project: "MP", type: "story", title: "Organizar projetos" })
    assert.equal(story.key, "MP-1")
    const task = await store.CreateItem({ project: "MP", type: "task", title: "Tela de board", parent: story.key })
    assert.equal(task.key, "MP-2")
    assert.equal(task.parentId, story.id)
    const sub = await store.CreateItem({ project: "MP", type: "subtask", title: "Componente card", parent: "MP-2" })
    assert.equal(sub.parentId, task.id)
})

test("bloqueia ciclo na hierarquia", async () => {
    // MP-1 (story) <- MP-2 (task) <- MP-3 (subtask). Mover MP-1 para dentro de MP-3 = ciclo.
    await assert.rejects(() => store.MoveItem({ item: "MP-1", parent: "MP-3" }), (e) => e.code === "VALIDATION_ERROR")
})

test("não move item para dentro de si mesmo", async () => {
    await assert.rejects(() => store.MoveItem({ item: "MP-2", parent: "MP-2" }), (e) => e.code === "VALIDATION_ERROR")
})

test("set-status done marca completedAt e progress 100", async () => {
    const updated = await store.SetStatus({ item: "MP-2", status: "done", actor: { source: "cli" } })
    assert.equal(updated.statusKey, "done")
    assert.equal(updated.progress, 100)
    assert.ok(updated.completedAt)
})

test("link e unlink entre itens", async () => {
    const link = await store.LinkItem({ item: "MP-1", relation: "blocks", target: "MP-3" })
    assert.equal(link.relation, "blocks")
    const dup = await store.LinkItem({ item: "MP-1", relation: "blocks", target: "MP-3" })
    assert.equal(dup.id, link.id) // idempotente
    const res = await store.UnlinkItem({ item: "MP-1", relation: "blocks", target: "MP-3" })
    assert.equal(res.removed, 1)
})

test("anexa arquivo com hash e metadata", async () => {
    const filePath = path.join(TMP, "log.txt")
    fs.writeFileSync(filePath, "hello mpm")
    const att = await store.AddFileAttachment({ item: "MP-1", filePath, description: "log" })
    assert.ok(att.sha256)
    assert.equal(att.type, "log")
    assert.ok(fs.existsSync(att.storagePath))
    const read = await store.ReadAttachment({ attachment: att.id })
    assert.equal(read.buffer.toString(), "hello mpm")
})

test("cria usuário humano e usuário agente", async () => {
    const human = await store.CreateUser({ type: "human", name: "Kaio", handle: "kaio" })
    assert.equal(human.type, "human")
    const agent = await store.CreateAgent({ provider: "claude", owner: "kaio", name: "Claude / Kaio", handle: "claude-kaio", defaultModel: "claude-sonnet-4" })
    assert.equal(agent.provider, "claude")
    assert.ok(agent.user.id)
})

test("sessão sem confirm fica pending; confirm ativa", async () => {
    const pending = await store.RegisterSession({ agent: "claude-kaio", description: "impl" })
    assert.equal(pending.status, "pending_confirmation")
    assert.equal(pending.modelName, "claude-sonnet-4") // herdou defaultModel
    const confirmed = await store.ConfirmSession({ session: pending.id })
    assert.equal(confirmed.status, "active")
    assert.ok(confirmed.confirmedAt)
})

test("sessão com confirm=true já nasce active", async () => {
    const s = await store.RegisterSession({ agent: "claude-kaio", model: "claude-sonnet-4", confirm: true })
    assert.equal(s.status, "active")
})

test("não arquiva usuário com itens sem force", async () => {
    await store.CreateItem({ project: "MP", type: "task", title: "Do agente", assignee: "claude-kaio" })
    const agentUser = (await store.ListUsers({ type: "agent" }))[0]
    await assert.rejects(() => store.ArchiveUser({ user: agentUser.handle }), (e) => e.code === "FORBIDDEN")
})

test("gera eventos de auditoria em mutações", async () => {
    const activity = await store.ListActivity({ projectId: (await store.GetProject({ project: "MP" })).id, limit: 100 })
    const actions = activity.map((a) => a.action)
    assert.ok(actions.includes("create"))
    assert.ok(actions.includes("set-status"))
    assert.ok(events.some((e) => e.type === "item.created"))
    assert.ok(events.some((e) => e.type === "audit.created"))
})

test("relatórios: project-status e by-agent", async () => {
    const status = await store.ProjectStatus({ project: "MP" })
    assert.ok(status.total >= 4)
    const byAgent = await store.ByAgent({ project: "MP" })
    assert.ok(byAgent.length >= 1)
})

test("export/import de projeto", async () => {
    const dump = await store.ExportProject({ project: "MP" })
    assert.ok(dump.items.length >= 4)
    assert.equal(dump.project.slug, "meta-platform")
})

// ---- Gate de criação estrutural por agente (identidade inline) ----
const AGENT = { source: "agent", session: { provider: "claude", model: "claude-sonnet-4", traceId: "T-1", externalSessionId: "ext-1", host: "hostA", osUser: "kaio", pid: 4242, workingDirectory: "/w", repositoryUrl: "git@x", branchName: "feat/x", commitHash: "abc123", agentVersion: "claude-code 1.0" } }

test("agente criar PROJETO bloqueia e vira pedido pendente", async () => {
    await assert.rejects(
        () => store.CreateProject({ name: "Projeto do Agente", actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && !!e.details.pendingCreationId && e.details.type === "project"
    )
    // não criou o projeto
    const list = await store.ListProjects({ includeArchived: true })
    assert.ok(!list.some((p) => p.slug === "projeto-do-agente"))
})

test("pedido pendente carrega TODOS os detalhes da sessão", async () => {
    const pend = await store.ListCreationRequests({ status: "pending", type: "project" })
    assert.ok(pend.length >= 1)
    const r = pend[0]
    assert.equal(r.type, "project")
    assert.equal(r.payload.name, "Projeto do Agente")
    assert.equal(r.session.provider, "claude")
    assert.equal(r.session.modelName, "claude-sonnet-4")
    assert.equal(r.session.host, "hostA")
    assert.equal(r.session.pid, 4242)
    assert.equal(r.session.commitHash, "abc123")
    assert.equal(r.session.firstAttemptAction, "create-project")
})

test("aprovar pedido EXECUTA a criação do projeto", async () => {
    const pend = await store.ListCreationRequests({ status: "pending", type: "project" })
    const { result, request } = await store.ApproveCreation({ request: pend[0].id, actor: { actorUserId: "human-1", source: "gui" } })
    assert.equal(request.status, "approved")
    assert.equal(result.slug, "projeto-do-agente")
    const list = await store.ListProjects({ includeArchived: true })
    assert.ok(list.some((p) => p.slug === "projeto-do-agente"))
})

test("agente criar BOARD bloqueia; aprovar cria o board", async () => {
    await assert.rejects(
        () => store.CreateBoard({ project: "MP", name: "Board do Agente", actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.type === "board"
    )
    const pend = await store.ListCreationRequests({ status: "pending", type: "board" })
    assert.ok(pend.length >= 1)
    const { result } = await store.ApproveCreation({ request: pend[0].id, actor: { actorUserId: "human-1", source: "gui" } })
    assert.equal(result.name, "Board do Agente")
})

test("agente mexer em ITEM/STATUS é LIVRE (sem gate)", async () => {
    const story = await store.CreateItem({ project: "MP", type: "story", title: "Item do agente", actor: AGENT })
    assert.ok(story.key) // criou sem bloqueio
    const upd = await store.SetStatus({ item: story.key, status: "in-progress", actor: AGENT })
    assert.equal(upd.statusKey, "in-progress") // status livre
})

test("rejeitar pedido não cria nada", async () => {
    await assert.rejects(() => store.CreateProject({ name: "Rejeitado", actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", type: "project" })).find((r) => r.payload.name === "Rejeitado")
    const rej = await store.RejectCreation({ request: pend.id, actor: { actorUserId: "human-1", source: "gui" } })
    assert.equal(rej.status, "rejected")
    const list = await store.ListProjects({ includeArchived: true })
    assert.ok(!list.some((p) => p.slug === "rejeitado"))
})

// ---- Milestones / Sprints / Roadmap ----
test("cria milestone e progresso reflete itens", async () => {
    const m = await store.CreateMilestone({ project: "MP", name: "Release 1", targetDate: "2026-08-01", actor: { source: "cli" } })
    assert.ok(m.id)
    await store.AssignItemPlanning({ item: "MP-2", milestone: m.id }) // MP-2 está done
    const got = await store.GetMilestone({ milestone: m.id })
    assert.equal(got.totalItems, 1)
    assert.equal(got.progress, 100)
})

test("roadmap lista milestones por data com progresso", async () => {
    const rm = await store.Roadmap({ project: "MP" })
    assert.ok(rm.length >= 1)
    assert.ok(rm[0].progress !== undefined && rm[0].targetDate !== undefined)
})

test("cria sprint e filtra itens por milestone", async () => {
    const s = await store.CreateSprint({ project: "MP", name: "Sprint 1", startDate: "2026-07-01", endDate: "2026-07-14", actor: { source: "cli" } })
    assert.equal(s.status, "planned")
    const rm = await store.Roadmap({ project: "MP" })
    const items = await store.ListItems({ project: "MP", milestone: rm[0].id })
    assert.ok(items.some((i) => i.key === "MP-2"))
})

test("agente criar milestone é gated; aprovar cria", async () => {
    await assert.rejects(
        () => store.CreateMilestone({ project: "MP", name: "M do Agente", actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.type === "milestone"
    )
    const pend = (await store.ListCreationRequests({ status: "pending", type: "milestone" }))[0]
    const { result } = await store.ApproveCreation({ request: pend.id, actor: { actorUserId: "h", source: "gui" } })
    assert.equal(result.name, "M do Agente")
})

// ---- Fase 1: modelo de planejamento ----
test("novos tipos epic/feature e status candidate", async () => {
    const epic = await store.CreateItem({ project: "MP", type: "epic", title: "Epic Planejamento" })
    assert.equal(epic.type, "epic")
    const feat = await store.CreateItem({ project: "MP", type: "feature", title: "Feature X", parent: epic.key })
    assert.equal(feat.parentId, epic.id)
    const proj = await store.CreateProject({ name: "Candidato", status: "candidate", actor: { source: "cli" } })
    assert.equal(proj.status, "candidate")
})

test("campos de planejamento (horizon/clarity/effort/value/area) + filtros", async () => {
    const idea = await store.CreateItem({ project: "MP", type: "feature", title: "CLI completa", horizon: "next", clarityState: "ready", effort: "l", value: "high", area: "CLI", ideaOrigin: "diagnóstico" })
    assert.equal(idea.horizon, "next")
    assert.equal(idea.area, "CLI")
    const byHorizon = await store.ListItems({ project: "MP", horizon: "next" })
    assert.ok(byHorizon.some((i) => i.key === idea.key))
    const byArea = await store.ListItems({ project: "MP", area: "CLI" })
    assert.ok(byArea.some((i) => i.key === idea.key))
})

test("horizon inválido é rejeitado", async () => {
    await assert.rejects(() => store.CreateItem({ project: "MP", title: "x", horizon: "zzz" }), (e) => e.code === "VALIDATION_ERROR" && e.details.field === "horizon")
})

test("inbox: item horizon=inbox e RoadmapByHorizon agrupa", async () => {
    await store.CreateItem({ project: "MP", title: "Ideia bruta", horizon: "inbox", clarityState: "idea" })
    const buckets = await store.RoadmapByHorizon({ project: "MP" })
    assert.ok(buckets.inbox.some((i) => i.title === "Ideia bruta"))
    assert.ok(buckets.next.length >= 1) // da feature "CLI completa"
})

test("backlog priorizado: sort por valor (semântico)", async () => {
    await store.CreateItem({ project: "MP", title: "Baixo valor", horizon: "later", value: "low" })
    await store.CreateItem({ project: "MP", title: "Crítico", horizon: "later", value: "critical" })
    const sorted = await store.ListItems({ project: "MP", horizon: "later", sort: "value" })
    assert.equal(sorted[0].value, "critical") // crítico vem primeiro
})

test("anexo associado a comentário (commentId)", async () => {
    const c = await store.AddComment({ item: "MP-1", body: "com anexo" })
    const att = await store.AddBufferAttachment({ item: "MP-1", name: "n.txt", base64: Buffer.from("x").toString("base64"), commentId: c.id })
    assert.equal(att.commentId, c.id)
})
