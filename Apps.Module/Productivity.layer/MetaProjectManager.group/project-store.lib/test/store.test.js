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

// Política de gate: planejar dentro do projeto é livre; remover e mexer na
// estrutura/identidade do projeto exige um humano.
test("agente cria milestone/sprint livremente (planejamento é reversível)", async () => {
    const m = await store.CreateMilestone({ project: "MP", name: "M do Agente", actor: AGENT })
    assert.equal(m.name, "M do Agente")
    const sp = await store.CreateSprint({ project: "MP", name: "S do Agente", actor: AGENT })
    assert.equal(sp.name, "S do Agente")
})

test("agente remover milestone é gated; aprovar remove", async () => {
    const m = await store.CreateMilestone({ project: "MP", name: "M a remover", actor: { source: "cli" } })
    await assert.rejects(
        () => store.DeleteMilestone({ milestone: m.id, actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.type === "milestone" && e.details.actionName === "delete"
    )
    const pend = (await store.ListCreationRequests({ status: "pending", type: "milestone", actionName: "delete" }))[0]
    const { result } = await store.ApproveRequest({ request: pend.id, actor: { actorUserId: "h", source: "gui" } })
    assert.equal(result.deleted, true)
    const left = await store.ListMilestones({ project: "MP" })
    assert.ok(!left.some((x) => x.id === m.id))
})

test("agente reescrever descrição do projeto é gated; ajuste operacional passa", async () => {
    // repositoryUrl não é campo sensível: passa direto.
    const ok = await store.UpdateProject({ project: "MP", repositoryUrl: "https://x/y", actor: AGENT })
    assert.equal(ok.repositoryUrl, "https://x/y")

    await assert.rejects(
        () => store.UpdateProject({ project: "MP", description: "reescrita pelo agente", actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.actionName === "update"
    )
    const pend = (await store.ListCreationRequests({ status: "pending", type: "project", actionName: "update" }))[0]
    const { result } = await store.ApproveRequest({ request: pend.id, actor: { actorUserId: "h", source: "gui" } })
    assert.equal(result.description, "reescrita pelo agente")
})

test("agente mexer em coluna do board é gated (estrutura do fluxo)", async () => {
    const boards = await store.ListBoards({ project: "MP" })
    await assert.rejects(
        () => store.AddColumn({ board: boards[0].id, name: "Coluna do Agente", actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.type === "column"
    )
    const pend = (await store.ListCreationRequests({ status: "pending", type: "column" }))[0]
    const { result } = await store.ApproveRequest({ request: pend.id, actor: { actorUserId: "h", source: "gui" } })
    assert.equal(result.name, "Coluna do Agente")
})

test("agente arquivar projeto é gated", async () => {
    const p = await store.CreateProject({ name: "Arquivavel", keyPrefix: "ARQ", actor: { source: "cli" } })
    await assert.rejects(
        () => store.ArchiveProject({ project: p.id, actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.actionName === "archive"
    )
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "archive" }))[0]
    const { result } = await store.ApproveRequest({ request: pend.id, actor: { actorUserId: "h", source: "gui" } })
    assert.equal(result.status, "archived")
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

// ---- Gate de DELETE por agente (aprovação genérica + wait + impacto) ----
test("agente deletar ITEM bloqueia e vira pedido destrutivo pendente", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "A remover pelo agente" })
    await assert.rejects(
        () => store.DeleteItem({ item: it.key, actor: AGENT }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED" && e.details.actionName === "delete" && e.details.type === "item"
    )
    // item NÃO foi deletado
    const still = await store.GetItem({ item: it.key })
    assert.equal(still.id, it.id)
    // pedido pendente carrega actionName/risk/targetId + "quem" + impacto (o QUE)
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
    assert.ok(pend)
    assert.equal(pend.risk, "destructive")
    assert.equal(pend.who.provider, "claude")
    assert.equal(pend.who.model, "claude-sonnet-4")
    assert.equal(pend.impact.targetType, "item")
    assert.ok(pend.impact.targetLabel.includes(it.key))
})

test("aprovar pedido de delete EXECUTA o soft delete", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Delete aprovado" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
    const { request, result } = await store.ApproveRequest({ request: pend.id, actor: { actorUserId: "human-1", source: "gui" } })
    assert.equal(request.status, "approved")
    assert.equal(result.deleted, true)
    // item some das consultas (soft delete)
    await assert.rejects(() => store.GetItem({ item: it.id }), (e) => e.code === "NOT_FOUND")
})

test("rejeitar delete com motivo preserva o item e grava rejectionReason", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Delete rejeitado" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
    const rej = await store.RejectRequest({ request: pend.id, reason: "não é para remover", actor: { actorUserId: "human-1", source: "gui" } })
    assert.equal(rej.status, "rejected")
    assert.equal(rej.rejectionReason, "não é para remover")
    const still = await store.GetItem({ item: it.id })
    assert.equal(still.id, it.id)
})

// A GUI e a CLI rodam no desktop e não têm login: chamam approve/reject sem
// actorUserId. Antes, a decisão era gravada como actorType "system" e o pedido
// ficava com decidedByUserId null — apagando quem autorizou, que é a única
// informação que o gate existe para produzir.
test("aprovar sem actorUserId credita o usuario-desktop, não system", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Aprovado pela GUI" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)

    const { request } = await store.ApproveRequest({ request: pend.id, actor: { source: "api" } })

    const desktop = await store.EnsureDesktopUser()
    assert.equal(request.decidedByUserId, desktop.id)

    const [ev] = await store.ListActivity({ action: "approve", limit: 1, actor: { source: "gui" } })
    assert.equal(ev.entityId, pend.id)
    assert.equal(ev.actorType, "desktop")
    assert.equal(ev.actorUserId, desktop.id)
})

test("rejeitar sem actorUserId também credita o usuario-desktop", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Rejeitado pela GUI" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)

    const rej = await store.RejectRequest({ request: pend.id, reason: "não", actor: { source: "api" } })

    const desktop = await store.EnsureDesktopUser()
    assert.equal(rej.decidedByUserId, desktop.id)
    const [ev] = await store.ListActivity({ action: "reject", limit: 1, actor: { source: "gui" } })
    assert.equal(ev.actorType, "desktop")
})

// O fallback NÃO pode mascarar um agente: se um agente chamar approve pela CLI,
// a auditoria tem que continuar dizendo "agent", nunca "desktop".
test("ator com identidade de agente nunca vira usuario-desktop ao aprovar", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Agente aprovando" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)

    await store.ApproveRequest({ request: pend.id, actor: AGENT })

    const [ev] = await store.ListActivity({ action: "approve", limit: 1, actor: { source: "gui" } })
    assert.equal(ev.entityId, pend.id)
    assert.equal(ev.actorType, "agent")
    const desktop = await store.EnsureDesktopUser()
    assert.notEqual(ev.actorUserId, desktop.id)
})

test("idempotência: mesmo resumeToken reusa o pedido pendente", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Idempotente" })
    const AG = { ...AGENT, resumeToken: "tok-del-1" }
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AG }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AG }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).filter((r) => r.resumeToken === "tok-del-1")
    assert.equal(pend.length, 1) // não duplicou
})

test("WaitForApproval retorna assim que o pedido é aprovado", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Espera" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
    // aprova em paralelo enquanto WaitForApproval faz polling
    const waiting = store.WaitForApproval({ request: pend.id, pollMs: 20 })
    await store.ApproveRequest({ request: pend.id, actor: { actorUserId: "human-1", source: "gui" } })
    const final = await waiting
    assert.equal(final.status, "approved")
    assert.equal(final.result.deleted, true)
})

test("WaitForApproval respeita timeout quando ninguém decide", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Timeout" })
    await assert.rejects(() => store.DeleteItem({ item: it.key, actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", actionName: "delete" })).find((r) => r.targetId === it.id)
    const final = await store.WaitForApproval({ request: pend.id, timeoutMs: 50, pollMs: 20 })
    assert.equal(final.timedOut, true)
    assert.equal(final.status, "pending")
})

// ---- Fase 2: shortDescription, usuario-desktop, activity notes, permissões, audit ----
test("shortDescription é persistido e validado (<=240)", async () => {
    const p = await store.CreateProject({ name: "Curto", shortDescription: "Uma linha curta.", actor: { source: "cli" } })
    assert.equal(p.shortDescription, "Uma linha curta.")
    await assert.rejects(
        () => store.CreateProject({ name: "Longo", shortDescription: "x".repeat(241) }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.field === "shortDescription"
    )
    // nunca grava fallback derivado da description
    const p2 = await store.CreateProject({ name: "Sem curta", description: "descrição longa" })
    assert.ok(!p2.shortDescription)
})

test("usuario-desktop é semeado e é idempotente", async () => {
    const d1 = await store.EnsureDesktopUser()
    const d2 = await store.EnsureDesktopUser()
    assert.equal(d1.id, d2.id)
    assert.equal(d1.handle, "usuario-desktop")
    assert.equal(d1.type, "desktop")
})

test("nota de atividade sem autor é atribuída ao usuario-desktop", async () => {
    const note = await store.AddActivityNote({ item: "MP-1", text: "Revisei isso à mão." })
    const desktop = await store.EnsureDesktopUser()
    assert.equal(note.authorUserId, desktop.id)
    assert.equal(note.scopeType, "item")
    const notes = await store.ListActivityNotes({ item: "MP-1" })
    assert.ok(notes.some((n) => n.body === "Revisei isso à mão."))
})

test("nota de projeto aparece na listagem do projeto", async () => {
    await store.AddActivityNote({ project: "MP", text: "Nota de projeto" })
    const notes = await store.ListActivityNotes({ project: "MP" })
    assert.ok(notes.some((n) => n.body === "Nota de projeto"))
})

test("GetActivityContext devolve notas + auditoria do escopo", async () => {
    const ctx = await store.GetActivityContext({ item: "MP-1" })
    assert.equal(ctx.scope.scopeType, "item")
    assert.ok(Array.isArray(ctx.notes) && Array.isArray(ctx.audit))
})

test("consulta global de atividade por AGENTE sem permissão => FORBIDDEN", async () => {
    await assert.rejects(
        () => store.ListActivity({ actor: AGENT }),
        (e) => e.code === "FORBIDDEN" && e.details.permission === "activity:read:all_projects"
    )
    // humano (sem session) passa livre
    const all = await store.ListActivity({ actor: { source: "gui" } })
    assert.ok(Array.isArray(all))
})

test("agente COM permissão global consegue consultar tudo", async () => {
    // descobre o usuário-agente criado pela identidade inline e concede a permissão
    const sessions = await store.ListSessions({})
    const agentUserId = sessions[0].agentUserId
    await store.SetUserPermissions({ user: agentUserId, permissions: ["activity:read:all_projects"], actor: { source: "gui" } })
    const rows = await store.ListActivity({ actor: { source: "agent", actorUserId: agentUserId } })
    assert.ok(Array.isArray(rows))
})

test("permissão inválida é rejeitada", async () => {
    const d = await store.EnsureDesktopUser()
    await assert.rejects(
        () => store.SetUserPermissions({ user: d.id, permissions: ["nao:existe"] }),
        (e) => e.code === "VALIDATION_ERROR"
    )
})

test("auditoria grava diff antes→depois e identidade do ator", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Diff" })
    await store.SetStatus({ item: it.key, status: "in-progress", actor: AGENT })
    const events = await store.ListActivity({ projectId: (await store.GetProject({ project: "MP" })).id, entityType: "work-item", entityId: it.id })
    const ev = events.find((e) => e.action === "set-status")
    assert.ok(ev)
    assert.equal(ev.before.statusKey, "backlog")
    assert.equal(ev.after.statusKey, "in-progress")
    assert.equal(ev.actorType, "agent")
    assert.equal(ev.provider, "claude")
    assert.equal(ev.model, "claude-sonnet-4")
})

test("filtros de auditoria: por ação, actorType e provider", async () => {
    const byAction = await store.ListActivity({ action: "set-status", actor: { source: "gui" } })
    assert.ok(byAction.every((e) => e.action === "set-status"))
    const byAgent = await store.ListActivity({ actorType: "agent", actor: { source: "gui" } })
    assert.ok(byAgent.every((e) => e.actorType === "agent"))
    const byProvider = await store.ListActivity({ provider: "claude", actor: { source: "gui" } })
    assert.ok(byProvider.every((e) => e.provider === "claude"))
})

test("GetAuditEvent devolve o evento hidratado", async () => {
    const [first] = await store.ListActivity({ limit: 1, actor: { source: "gui" } })
    const ev = await store.GetAuditEvent({ event: first.id })
    assert.equal(ev.id, first.id)
})

test("nota sem autor humano é auditada como actorType=desktop", async () => {
    const note = await store.AddActivityNote({ project: "MP", text: "nota desktop" })
    const events = await store.ListActivity({ entityType: "activity-note", entityId: note.id, actor: { source: "gui" } })
    assert.equal(events[0].actorType, "desktop")
})

// ---- Regressões reportadas em uso real (7 bugs) ----
test("#1 setDefault mantém board.isDefault coerente com project.defaultBoardId", async () => {
    const p = await store.CreateProject({ name: "Default Board", keyPrefix: "DFB" })
    const b1 = await store.CreateBoard({ project: p.id, name: "B1" })       // 1º board vira padrão
    assert.equal(b1.isDefault, true)
    const b2 = await store.CreateBoard({ project: p.id, name: "B2", setDefault: true })
    assert.equal(b2.isDefault, true)
    const boards = await store.ListBoards({ project: p.id })
    assert.equal(boards.filter((b) => b.isDefault).length, 1)              // só um padrão
    assert.equal(boards.find((b) => b.isDefault).id, b2.id)
    assert.equal((await store.GetProject({ project: p.id })).defaultBoardId, b2.id)
    // SetDefaultBoard volta para o B1
    await store.SetDefaultBoard({ board: b1.id })
    assert.equal((await store.GetBoard({ board: b1.id })).isDefault, true)
    assert.equal((await store.GetBoard({ board: b2.id })).isDefault, false)
})

test("#2 auditoria grava diff em assign/block/move/convert/board-update", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Diff amplo" })
    const u = await store.CreateUser({ type: "human", name: "Diffy", handle: "diffy" })
    await store.Assign({ item: it.id, user: u.id })
    await store.SetBlocked({ item: it.id, reason: "trava" })
    await store.ConvertItem({ item: it.id, type: "bug" })
    const evs = await store.ListActivity({ projectId: it.projectId, entityType: "work-item", entityId: it.id, actor: { source: "gui" } })
    for(const action of ["assign", "block", "convert"]){
        const e = evs.find((x) => x.action === action)
        assert.ok(e, `faltou evento ${action}`)
        assert.ok(e.before && e.after, `${action} sem diff`)
    }
    const assign = evs.find((x) => x.action === "assign")
    assert.equal(assign.after.assigneeUserId, u.id)
})

test("#3 add link attachment aceita file:// e rejeita esquema desconhecido", async () => {
    const att = await store.AddLinkAttachment({ item: "MP-1", url: "file:///tmp/build.log", name: "log" })
    assert.equal(att.externalUrl, "file:///tmp/build.log")
    await assert.rejects(
        () => store.AddLinkAttachment({ item: "MP-1", url: "javascript:alert(1)" }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.allowed.includes("file")
    )
})

test("#4 nota escrita por AGENTE é atribuída ao usuário-agente, não ao desktop", async () => {
    const note = await store.AddActivityNote({ project: "MP", text: "feito pelo agente", actor: AGENT })
    const author = await store.GetUser({ user: note.authorUserId })
    assert.equal(author.type, "agent")
    assert.ok(note.authorSessionId)
    // e a auditoria marca actorType agent
    const evs = await store.ListActivity({ entityType: "activity-note", entityId: note.id, actor: { source: "gui" } })
    assert.equal(evs[0].actorType, "agent")
    // sem ator continua caindo no usuario-desktop
    const manual = await store.AddActivityNote({ project: "MP", text: "manual" })
    const d = await store.GetUser({ user: manual.authorUserId })
    assert.equal(d.handle, "usuario-desktop")
})

test("#5 AssignItemPlanning vincula item a milestone e sprint (totalItems reflete)", async () => {
    const p = await store.CreateProject({ name: "Planning", keyPrefix: "PLN" })
    const m = await store.CreateMilestone({ project: p.id, name: "M" })
    const s = await store.CreateSprint({ project: p.id, name: "S" })
    const it = await store.CreateItem({ project: p.id, type: "task", title: "vinculado" })
    await store.AssignItemPlanning({ item: it.id, milestone: m.id, sprint: s.id })
    assert.equal((await store.ListMilestones({ project: p.id }))[0].totalItems, 1)
    assert.equal((await store.ListSprints({ project: p.id }))[0].totalItems, 1)
    // "none" desvincula
    await store.AssignItemPlanning({ item: it.id, milestone: "none" })
    assert.equal((await store.ListMilestones({ project: p.id }))[0].totalItems, 0)
})

test("#6 keyPrefix inválido erra com sugestão, em vez de truncar em silêncio", async () => {
    await assert.rejects(
        () => store.CreateProject({ name: "A", keyPrefix: "MUITOLONGO" }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.max === 5 && e.details.suggestion === "MUITO"
    )
    await assert.rejects(
        () => store.CreateProject({ name: "B", keyPrefix: "MP-M" }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.suggestion === "MPM"
    )
    // prefixo válido passa; derivado do nome continua sendo cortado sem erro
    assert.equal((await store.CreateProject({ name: "C", keyPrefix: "ABCDE" })).keyPrefix, "ABCDE")
    assert.equal((await store.CreateProject({ name: "Um Dois Tres Quatro Cinco Seis" })).keyPrefix, "UDTQC")
})

test("#7 LinkItem só aceita as relações reais do domínio", async () => {
    const a = await store.CreateItem({ project: "MP", type: "task", title: "A link" })
    const b = await store.CreateItem({ project: "MP", type: "task", title: "B link" })
    await store.LinkItem({ item: a.id, relation: "depends", target: b.id })
    await assert.rejects(
        () => store.LinkItem({ item: a.id, relation: "depends-on", target: b.id }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.allowed.includes("depends")
    )
})

test("histórico de pedidos: status=all, filtro por agente e por sessão", async () => {
    const all = await store.ListCreationRequests({ status: "all" })
    assert.ok(all.length >= 3)
    assert.ok(all.some((r) => r.status !== "pending"))   // inclui aprovados/rejeitados
    const sessions = await store.ListSessions({})
    const sid = sessions[0].id
    const bySession = await store.ListCreationRequests({ status: "all", session: sid })
    assert.ok(bySession.every((r) => r.agentSessionId === sid))
    const byAgent = await store.ListCreationRequests({ status: "all", agent: sessions[0].agentUserId })
    assert.ok(byAgent.length >= bySession.length)
})

// ---- Feedback do humano para os agentes (fila com claim exclusivo) ----

// Dois agentes distintos disputando a mesma fila.
const AGENT_A = { source: "agent", actorSessionId: "sess-A", session: { provider: "claude", model: "opus", traceId: "TA" } }
const AGENT_B = { source: "agent", actorSessionId: "sess-B", session: { provider: "codex", model: "gpt", traceId: "TB" } }

test("feedback nasce aberto, guarda ONDE foi dado e espelha um comentário no item", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Item com feedback" })
    const fb = await store.CreateFeedback({
        item: it.key, field: "description", fieldLabel: "Descrição",
        screen: "/projects/x/board", excerpt: "texto antigo",
        body: "Está longo demais, resuma.", actor: { source: "gui", actorUserId: "h" }
    })
    assert.equal(fb.status, "open")
    assert.equal(fb.field, "description")
    assert.equal(fb.workItemId, it.id)
    assert.equal(fb.excerpt, "texto antigo")

    const comments = await store.ListComments({ item: it.id })
    assert.ok(comments.some((c) => c.body.indexOf("Feedback para o agente") >= 0))
})

test("claim é exclusivo: o segundo agente recebe CONFLICT", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Disputa" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    const claimed = await store.ClaimFeedback({ feedback: fb.id, actor: AGENT_A })
    assert.equal(claimed.status, "in-analysis")
    assert.equal(claimed.claimedByProvider, "claude")

    await assert.rejects(
        () => store.ClaimFeedback({ feedback: fb.id, actor: AGENT_B }),
        (e) => e.code === "CONFLICT"
    )
    // e some da fila de "open" enquanto o claim está vivo
    const open = await store.ListFeedback({ project: "MP", status: "open" })
    assert.ok(!open.some((f) => f.id === fb.id))
})

test("claim vencido volta para a fila e outro agente assume", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Agente sumiu" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    // ttl negativo = já vencido (é o mesmo caminho de um agente que morreu)
    await store.ClaimFeedback({ feedback: fb.id, ttlSeconds: -1, actor: AGENT_A })

    const open = await store.ListFeedback({ project: "MP", status: "open" })
    assert.ok(open.some((f) => f.id === fb.id), "feedback com claim vencido deve voltar para a fila")

    const retaken = await store.ClaimFeedback({ feedback: fb.id, actor: AGENT_B })
    assert.equal(retaken.claimedByProvider, "codex")
})

test("resolver exige claim vivo e do próprio agente", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Resolver" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    // sem claim, o agente não resolve
    await assert.rejects(
        () => store.ResolveFeedback({ feedback: fb.id, actor: AGENT_A }),
        (e) => e.code === "CONFLICT"
    )
    await store.ClaimFeedback({ feedback: fb.id, actor: AGENT_A })
    // outro agente também não
    await assert.rejects(
        () => store.ResolveFeedback({ feedback: fb.id, actor: AGENT_B }),
        (e) => e.code === "CONFLICT"
    )
    const done = await store.ResolveFeedback({ feedback: fb.id, note: "reescrito", actor: AGENT_A })
    assert.equal(done.status, "resolved")

    // resolvido some da fila
    const open = await store.ListFeedback({ project: "MP", status: "open" })
    assert.ok(!open.some((f) => f.id === fb.id))
})

test("humano descarta e reabre; agente devolve com release", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Ciclo" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    await store.ClaimFeedback({ feedback: fb.id, actor: AGENT_A })
    const released = await store.ReleaseFeedback({ feedback: fb.id, actor: AGENT_A })
    assert.equal(released.status, "open")

    const dismissed = await store.DismissFeedback({ feedback: fb.id, reason: "não quero mais", actor: { source: "gui" } })
    assert.equal(dismissed.status, "dismissed")
    await assert.rejects(() => store.ClaimFeedback({ feedback: fb.id, actor: AGENT_A }), (e) => e.code === "CONFLICT")

    const reopened = await store.ReopenFeedback({ feedback: fb.id, actor: { source: "gui" } })
    assert.equal(reopened.status, "open")
    const again = await store.ClaimFeedback({ feedback: fb.id, actor: AGENT_B })
    assert.equal(again.status, "in-analysis")
})

test("feedback filtra por item e por janela de tempo", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Janela" })
    const fb = await store.CreateFeedback({ item: it.key, body: "no intervalo", actor: { source: "gui" } })

    const byItem = await store.ListFeedback({ project: "MP", status: "all", item: it.key })
    assert.equal(byItem.length, 1)
    assert.equal(byItem[0].id, fb.id)

    const future = new Date(Date.now() + 60_000).toISOString()
    const none = await store.ListFeedback({ project: "MP", status: "all", since: future })
    assert.equal(none.length, 0)

    const past = new Date(Date.now() - 60_000).toISOString()
    const some = await store.ListFeedback({ project: "MP", status: "all", since: past })
    assert.ok(some.length >= 1)
})

// ---- Contexto do ecossistema (Meta Platform) ----
//
// O catálogo vem do disco; os testes montam um repositório de mentira e apontam
// o ecosystemDataPath para ele — nada depende da máquina de quem roda.
const fsx = require("fs")

const makeFakeEcosystem = () => {
    const root = path.join(TMP, "eco")
    const repo = path.join(root, "repos", "FakeRepo")
    const pkgs = [
        "Apps.Module/Productivity.layer/Demo.group/demo.webgui",
        "Apps.Module/Productivity.layer/Demo.group/demo.lib",
        "Main.Module/Application.layer/solo.cli"
    ]
    for (const rel of pkgs) fsx.mkdirSync(path.join(repo, rel, "metadata"), { recursive: true })
    for (const rel of pkgs) fsx.writeFileSync(path.join(repo, rel, "metadata", "package.json"), "{}")
    // ruído: contêiner sem pacote e node_modules
    fsx.mkdirSync(path.join(repo, "Apps.Module/Empty.layer"), { recursive: true })
    fsx.mkdirSync(path.join(repo, "node_modules/x.lib/metadata"), { recursive: true })
    fsx.writeFileSync(path.join(repo, "node_modules/x.lib/metadata/package.json"), "{}")

    fsx.mkdirSync(root, { recursive: true })
    fsx.writeFileSync(path.join(root, "repositories.json"), JSON.stringify({
        FakeRepo: { installationPath: repo, sourceData: { sourceType: "LOCAL_FS", path: repo } }
    }))
    return root
}

let ecoStore
test("indexa os pacotes do disco, ignorando contêineres e node_modules", async () => {
    const ecosystemDataPath = makeFakeEcosystem()
    ecoStore = InitializeProjectStore({
        storage: path.join(TMP, "eco.sqlite"),
        attachmentsDirPath: path.join(TMP, "att"),
        ecosystemDataPath
    })
    await ecoStore.ConnectAndSync()

    const result = await ecoStore.IndexEcosystemPackages({ actor: { source: "cli" } })
    assert.equal(result.indexed, 3)

    const all = await ecoStore.ListEcosystemPackages({})
    const names = all.map((p) => p.packageName).sort()
    assert.deepEqual(names, ["demo.lib", "demo.webgui", "solo.cli"])

    // hierarquia decomposta, com e sem grupo
    const webgui = all.find((p) => p.packageName === "demo.webgui")
    assert.equal(webgui.moduleName, "Apps.Module")
    assert.equal(webgui.layerName, "Productivity.layer")
    assert.equal(webgui.groupName, "Demo.group")
    assert.equal(webgui.packageType, "webgui")
    assert.equal(webgui.repositoryName, "FakeRepo")

    const solo = all.find((p) => p.packageName === "solo.cli")
    assert.equal(solo.groupName, null)
})

test("um pacote que some do disco fica ausente, não é apagado", async () => {
    const removed = path.join(TMP, "eco", "repos", "FakeRepo", "Main.Module/Application.layer/solo.cli")
    fsx.rmSync(removed, { recursive: true, force: true })

    const result = await ecoStore.IndexEcosystemPackages({ actor: { source: "cli" } })
    assert.equal(result.markedMissing, 1)

    const visible = await ecoStore.ListEcosystemPackages({})
    assert.ok(!visible.some((p) => p.packageName === "solo.cli"))

    const withMissing = await ecoStore.ListEcosystemPackages({ includeMissing: true })
    assert.ok(withMissing.some((p) => p.packageName === "solo.cli"))
})

test("um item toca VÁRIOS pacotes, e dá para filtrar itens por pacote", async () => {
    const p = await ecoStore.CreateProject({ name: "Eco", keyPrefix: "ECO", actor: { source: "cli" } })
    const it = await ecoStore.CreateItem({ project: p.id, type: "task", title: "Muda GUI e lib" })

    await ecoStore.SetItemPackages({
        item: it.key,
        packages: [{ package: "demo.webgui", role: "primary" }, "demo.lib"],
        actor: { source: "gui" }
    })

    const full = await ecoStore.GetItem({ item: it.key })
    assert.equal(full.packages.length, 2)
    assert.equal(full.packages.find((x) => x.packageName === "demo.webgui").role, "primary")
    assert.equal(full.packages.find((x) => x.packageName === "demo.lib").role, "touched")

    // filtro: o que está aberto neste pacote?
    const byPackage = await ecoStore.ListItems({ project: p.id, package: "demo.lib" })
    assert.equal(byPackage.length, 1)
    assert.equal(byPackage[0].id, it.id)

    const other = await ecoStore.ListItems({ project: p.id, package: "FakeRepo:Main.Module/Application.layer/solo.cli" })
    assert.equal(other.length, 0)
})

test("vincular pacote inexistente falha; nome ambíguo pede o ref completo", async () => {
    const p = await ecoStore.ListItems({ limit: 1 })
    await assert.rejects(
        () => ecoStore.AddItemPackage({ item: p[0].key, package: "nao-existe.lib" }),
        (e) => e.code === "NOT_FOUND"
    )
    // "demo" casa com demo.webgui e demo.lib
    await assert.rejects(
        () => ecoStore.AddItemPackage({ item: p[0].key, package: "demo" }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.candidates.length === 2
    )
})

test("remover o vínculo tira o item do filtro daquele pacote", async () => {
    const [it] = await ecoStore.ListItems({ limit: 1 })
    await ecoStore.RemoveItemPackage({ item: it.key, package: "demo.lib", actor: { source: "gui" } })
    const left = await ecoStore.GetItem({ item: it.key })
    assert.equal(left.packages.length, 1)
    const byPackage = await ecoStore.ListItems({ package: "demo.lib" })
    assert.equal(byPackage.length, 0)
})
