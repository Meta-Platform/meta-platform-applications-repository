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

test("relatório final: set/get e persistência no GetProject", async () => {
    const md = "# Relatório\n\nPanorama do que foi feito. Ver [[MP-1]] e commit `abc123`."
    const saved = await store.SetProjectReport({ project: "meta-platform", finalReport: md, actor: { source: "cli" } })
    assert.equal(saved.finalReport, md)
    const rep = await store.GetProjectReport({ project: "meta-platform" })
    assert.equal(rep.finalReport, md)
    assert.equal(rep.name, "Meta Platform")
    // GetProject também serializa a coluna (vem de graça).
    const proj = await store.GetProject({ project: "meta-platform" })
    assert.equal(proj.finalReport, md)
    // Também gravável via UpdateProject (allowlist), sem gate.
    const upd = await store.UpdateProject({ project: "meta-platform", finalReport: md + "\n\nAtualizado.", actor: { source: "cli" } })
    assert.ok(upd.finalReport.endsWith("Atualizado."))
})

test("relatório final: rejeita valor não-string", async () => {
    await assert.rejects(() => store.SetProjectReport({ project: "meta-platform", finalReport: 123 }), (e) => e.code === "VALIDATION_ERROR")
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

test("ListItems traz attachmentCount/commentCount para os cards", async () => {
    // MP-1 recebeu um anexo no teste anterior.
    const list = await store.ListItems({ project: "MP" })
    const mp1 = list.find((i) => i.key === "MP-1")
    assert.ok(mp1)
    assert.equal(mp1.attachmentCount >= 1, true)
    assert.equal(typeof mp1.commentCount, "number")
    // Um item recém-criado sem anexos vem com 0 (não undefined).
    const fresh = await store.CreateItem({ project: "MP", type: "task", title: "Sem anexos" })
    const flist = await store.ListItems({ project: "MP" })
    assert.equal(flist.find((i) => i.id === fresh.id).attachmentCount, 0)
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

test("agente: gate de iniciar/concluir tarefa (projeto ativo)", async () => {
    // Projeto ATIVO: criar item e transições NÃO-gated (ex.: review) são livres p/ agente.
    // (A trava de planejamento é do store do MCP — testada à parte com o flag.)
    const active = await store.CreateProject({ name: "Ativo Agente", status: "active", keyPrefix: "AGT", actor: { source: "cli" } })
    const story = await store.CreateItem({ project: active.id, type: "story", title: "Item do agente", actor: AGENT })
    assert.ok(story.key)
    const toReview = await store.SetStatus({ item: story.key, status: "review", actor: AGENT })
    assert.equal(toReview.statusKey, "review")

    // INICIAR (in-progress) e CONCLUIR (done) por agente exigem aprovação humana.
    await assert.rejects(() => store.SetStatus({ item: story.key, status: "in-progress", actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    await assert.rejects(() => store.SetStatus({ item: story.key, status: "done", actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")

    // Nem criar item já iniciado/concluído.
    await assert.rejects(() => store.CreateItem({ project: active.id, type: "task", title: "Já feito", statusKey: "done", actor: AGENT }), (e) => e.code === "AGENT_ACTION_REQUIRES_HUMAN")

    // Humano/CLI: iniciar/concluir seguem livres (o gate é só p/ agente).
    const byCli = await store.SetStatus({ item: story.key, status: "in-progress", actor: { source: "cli" } })
    assert.equal(byCli.statusKey, "in-progress")

    // O gate vira pedido aprovável: aprovar EXECUTA o set-status (executor set-status:work-item).
    await assert.rejects(() => store.SetStatus({ item: story.key, status: "done", actor: AGENT }), (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pend = (await store.ListCreationRequests({ status: "pending", type: "work-item", actionName: "set-status" })).find((r) => r.targetId === story.id)
    assert.ok(pend)
    await store.ApproveCreation({ request: pend.id, actor: { actorUserId: "human-1", source: "gui" } })
    assert.equal((await store.GetItem({ item: story.key })).statusKey, "done")
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
    // Projeto ATIVO e transição NÃO-gated (review) para o agente executar de fato e
    // a auditoria registrar sua identidade (in-progress/done passariam pelo gate).
    const active = await store.CreateProject({ name: "Auditoria Ativo", status: "active", keyPrefix: "AUD", actor: { source: "cli" } })
    const it = await store.CreateItem({ project: active.id, type: "task", title: "Diff" })
    await store.SetStatus({ item: it.key, status: "review", actor: AGENT })
    const events = await store.ListActivity({ projectId: active.id, entityType: "work-item", entityId: it.id })
    const ev = events.find((e) => e.action === "set-status")
    assert.ok(ev)
    assert.equal(ev.before.statusKey, "backlog")
    assert.equal(ev.after.statusKey, "review")
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

test("o próprio dono renova o claim vivo; outro agente ainda recebe CONFLICT", async () => {
    const it = await store.CreateItem({ project: "MP", type: "task", title: "Renovação" })
    const fb = await store.CreateFeedback({ item: it.key, body: "corrija", actor: { source: "gui" } })

    const first = await store.ClaimFeedback({ feedback: fb.id, ttlSeconds: 60, actor: AGENT_A })
    // renova antes de expirar: NÃO pode dar CONFLICT, e estende o prazo
    const renewed = await store.ClaimFeedback({ feedback: fb.id, ttlSeconds: 3600, actor: AGENT_A })
    assert.equal(renewed.status, "in-analysis")
    assert.equal(renewed.claimedByProvider, "claude")
    assert.ok(new Date(renewed.claimExpiresAt) > new Date(first.claimExpiresAt), "renovar deve empurrar claimExpiresAt para frente")

    // enquanto o claim de A está vivo, B continua barrado
    await assert.rejects(
        () => store.ClaimFeedback({ feedback: fb.id, actor: AGENT_B }),
        (e) => e.code === "CONFLICT"
    )
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

// ---- Migração de banco existente ----
//
// `sync()` só CRIA tabelas faltantes: uma coluna nova num modelo já existente
// não aparece sozinha. Quem esquece de declará-la em ADDED_COLUMNS derruba o app
// de quem já tem banco ("SQLITE_ERROR: no such column"), enquanto os testes —
// que sempre nascem de um banco novo — passam.
test("colunas novas do projeto chegam a um banco antigo (ALTER TABLE idempotente)", async () => {
    const dbFile = path.join(TMP, "migracao.sqlite")
    const CONTEXT_COLUMNS = ["contextRepository", "contextModule", "contextLayer", "contextGroup"]

    let old = InitializeProjectStore({ storage: dbFile, attachmentsDirPath: path.join(TMP, "att") })
    await old.ConnectAndSync()
    const created = await old.CreateProject({ name: "Antigo", keyPrefix: "ANT", actor: { source: "cli" } })
    // simula o banco de antes destas colunas existirem
    for (const column of CONTEXT_COLUMNS)
        await old.sequelize.query(`ALTER TABLE projects DROP COLUMN ${column}`)
    await old.sequelize.close()

    // reabrir aplica a migração; os dados continuam lá
    const migrated = InitializeProjectStore({ storage: dbFile, attachmentsDirPath: path.join(TMP, "att") })
    await migrated.ConnectAndSync()

    const projects = await migrated.ListProjects({})
    assert.equal(projects.length, 1)
    assert.equal(projects[0].name, "Antigo")

    const updated = await migrated.UpdateProject({
        project: created.id, contextGroup: "MetaProjectManager.group", actor: { source: "cli" }
    })
    assert.equal(updated.contextGroup, "MetaProjectManager.group")

    // rodar de novo não quebra (ADD COLUMN duplicado é ignorado)
    await migrated.ConnectAndSync()
    await migrated.sequelize.close()
})

test("item concluído não continua bloqueado (limpa blockedReason + some de 'Requer atenção')", async () => {
    const it = await store.CreateItem({ project: "meta-platform", type: "task", title: "Alvo bloqueio" })
    const b = await store.SetBlocked({ item: it.key, reason: "aguarda X" })
    assert.equal(b.statusKey, "blocked")
    assert.equal(b.blockedReason, "aguarda X")
    assert.ok((await store.Blocked({ project: "meta-platform" })).some((x) => x.id === it.id))
    assert.ok((await store.ProjectMetrics({ project: "meta-platform" })).blocked >= 1)
    const done = await store.SetStatus({ item: it.key, status: "done" })
    assert.equal(done.statusKey, "done")
    assert.equal(done.blockedReason, null)
    assert.ok(!(await store.Blocked({ project: "meta-platform" })).some((x) => x.id === it.id))
})

test("desbloquear: SetBlocked com motivo vazio limpa e sai da coluna blocked", async () => {
    const it = await store.CreateItem({ project: "meta-platform", type: "task", title: "Alvo desbloqueio" })
    await store.SetBlocked({ item: it.key, reason: "trava" })
    const un = await store.SetBlocked({ item: it.key, reason: "" })
    assert.equal(un.blockedReason, null)
    assert.equal(un.statusKey, "backlog")
})

test("documentação: árvore (páginas + sub-páginas), update, move sem ciclo, delete em cascata", async () => {
    const proj = await store.CreateProject({ name: "Doc Wiki", actor: { source: "cli" } })
    const raiz = await store.CreateDocPage({ project: proj.id, title: "Guia", body: "# Guia", actor: { source: "cli" } })
    const sub = await store.CreateDocPage({ project: proj.id, parentId: raiz.id, title: "Instalação", actor: { source: "cli" } })
    const neta = await store.CreateDocPage({ project: proj.id, parentId: sub.id, title: "Pré-requisitos", actor: { source: "cli" } })

    // Lista traz todas planas; a árvore é montada por parentId.
    const list = await store.ListDocPages({ project: proj.id })
    assert.equal(list.length, 3)
    assert.equal(list.filter((p) => p.parentId === raiz.id).length, 1)
    assert.equal((await store.GetDocPage({ docPage: raiz.id })).body, "# Guia")

    // Update do corpo.
    const upd = await store.UpdateDocPage({ docPage: sub.id, body: "passos...", title: "Instalação e setup" })
    assert.equal(upd.body, "passos...")
    assert.equal(upd.title, "Instalação e setup")

    // Move: raiz não pode virar filha de sua própria neta (ciclo).
    await assert.rejects(() => store.MoveDocPage({ docPage: raiz.id, parentId: neta.id }), (e) => e.code === "VALIDATION_ERROR")
    // Move válido: sub vira raiz.
    const moved = await store.MoveDocPage({ docPage: sub.id, parentId: "none" })
    assert.equal(moved.parentId, null)

    // Delete em cascata: apagar "Instalação" leva junto "Pré-requisitos".
    const del = await store.DeleteDocPage({ docPage: sub.id, actor: { source: "cli" } })
    assert.equal(del.removed, 2)
    const after = await store.ListDocPages({ project: proj.id })
    assert.equal(after.length, 1)
    assert.equal(after[0].id, raiz.id)
})

test("documentação em projeto arquivado é somente leitura", async () => {
    const proj = await store.CreateProject({ name: "Doc RO", actor: { source: "cli" } })
    const page = await store.CreateDocPage({ project: proj.id, title: "Nota", actor: { source: "cli" } })
    await store.ArchiveProject({ project: proj.id, actor: { source: "cli" } })
    const archived = (e) => e.code === "PROJECT_ARCHIVED"
    await assert.rejects(() => store.CreateDocPage({ project: proj.id, title: "X" }), archived)
    await assert.rejects(() => store.UpdateDocPage({ docPage: page.id, body: "y" }), archived)
    await assert.rejects(() => store.MoveDocPage({ docPage: page.id, order: 2 }), archived)
    await assert.rejects(() => store.DeleteDocPage({ docPage: page.id, actor: { source: "cli" } }), archived)
    // Leitura segue liberada.
    assert.equal((await store.ListDocPages({ project: proj.id })).length, 1)
})

test("projeto arquivado é somente leitura: escritas rejeitadas, leituras liberadas, restaurar reabre", async () => {
    // Projeto próprio com um item, board e planejamento para exercitar vários stores.
    const proj = await store.CreateProject({ name: "Arquivo RO", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: proj.id, type: "task", title: "Tarefa congelada" })
    const board = await store.CreateBoard({ project: proj.id, name: "Board RO", actor: { source: "cli" } })
    const ms = await store.CreateMilestone({ project: proj.id, name: "Entrega RO", actor: { source: "cli" } })
    const crit = await store.AddAcceptanceCriteria({ item: item.id, text: "critério" })

    await store.ArchiveProject({ project: proj.id, actor: { source: "cli" } })

    const archived = (e) => e.code === "PROJECT_ARCHIVED"
    // Escritas em vários stores devem falhar com PROJECT_ARCHIVED.
    await assert.rejects(() => store.UpdateItem({ item: item.id, title: "novo" }), archived)
    await assert.rejects(() => store.SetStatus({ item: item.id, status: "done" }), archived)
    await assert.rejects(() => store.CreateItem({ project: proj.id, type: "task", title: "novo item" }), archived)
    await assert.rejects(() => store.DeleteItem({ item: item.id, actor: { source: "cli" } }), archived)
    await assert.rejects(() => store.AddComment({ item: item.id, body: "oi" }), archived)
    await assert.rejects(() => store.AddChecklistItem({ item: item.id, text: "passo" }), archived)
    await assert.rejects(() => store.UpdateAcceptanceCriteria({ criteria: crit.id, met: true }), archived)
    await assert.rejects(() => store.CreateBoard({ project: proj.id, name: "Board 2", actor: { source: "cli" } }), archived)
    await assert.rejects(() => store.AddColumn({ board: board.id, name: "Coluna", actor: { source: "cli" } }), archived)
    await assert.rejects(() => store.UpdateMilestone({ milestone: ms.id, name: "x" }), archived)
    await assert.rejects(() => store.UpdateProject({ project: proj.id, description: "x", actor: { source: "cli" } }), archived)
    await assert.rejects(() => store.AddActivityNote({ project: proj.id, text: "nota" }), archived)
    await assert.rejects(() => store.CreateFeedback({ project: proj.id, entityType: "project", body: "muda isso" }), archived)

    // Leituras continuam liberadas.
    assert.equal((await store.GetItem({ item: item.id })).id, item.id)
    assert.ok(Array.isArray(await store.ListItems({ project: proj.id })))
    assert.equal((await store.GetProject({ project: proj.id })).status, "archived")

    // Restaurar reabre a escrita.
    await store.RestoreProject({ project: proj.id, actor: { source: "cli" } })
    const upd = await store.UpdateItem({ item: item.id, title: "editável de novo" })
    assert.equal(upd.title, "editável de novo")
})

// ---- Anexos de PÁGINA de documentação (doc-page-scoped) ----

test("anexo de página: upload/link/list/read, remove e cascata ao apagar a página", async () => {
    const proj = await store.CreateProject({ name: "Docs Anexo", actor: { source: "cli" } })
    const page = await store.CreateDocPage({ project: proj.id, title: "Página raiz", actor: { source: "cli" } })
    const sub = await store.CreateDocPage({ project: proj.id, parentId: page.id, title: "Sub", actor: { source: "cli" } })

    // Upload (buffer/base64) — imagem SVG, com MIME preservado.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    const att = await store.AddDocPageBufferAttachment({ docPage: page.id, name: "icone.svg", base64: svg.toString("base64"), mimeType: "image/svg+xml", actor: { source: "cli" } })
    assert.equal(att.docPageId, page.id)
    assert.equal(att.type, "image")
    assert.equal(att.mimeType, "image/svg+xml")
    assert.equal(att.sizeBytes, svg.length)

    // Link (http/https/file) — validação de esquema.
    const link = await store.AddDocPageLinkAttachment({ docPage: page.id, url: "https://example.com/spec", name: "spec", actor: { source: "cli" } })
    assert.equal(link.type, "link")
    await assert.rejects(() => store.AddDocPageLinkAttachment({ docPage: page.id, url: "javascript:alert(1)" }), (e) => e.code === "VALIDATION_ERROR")

    // List traz os dois.
    assert.equal((await store.ListDocPageAttachments({ docPage: page.id })).length, 2)

    // Read devolve o conteúdo original (não vale para link).
    const read = await store.ReadDocPageAttachment({ attachment: att.id })
    assert.ok(read.buffer.equals(svg))
    await assert.rejects(() => store.ReadDocPageAttachment({ attachment: link.id }), (e) => e.code === "VALIDATION_ERROR")

    // A sub-página tem o próprio anexo.
    const subAtt = await store.AddDocPageBufferAttachment({ docPage: sub.id, name: "s.txt", base64: Buffer.from("hi").toString("base64"), actor: { source: "cli" } })
    assert.equal((await store.ListDocPageAttachments({ docPage: sub.id })).length, 1)

    // Remove único (soft delete).
    const rm = await store.RemoveDocPageAttachment({ attachment: subAtt.id, actor: { source: "cli" } })
    assert.equal(rm.deleted, true)
    assert.equal((await store.ListDocPageAttachments({ docPage: sub.id })).length, 0)

    // Cascata: apagar a página raiz (e subárvore) some com os anexos das duas.
    await store.AddDocPageBufferAttachment({ docPage: sub.id, name: "s2.txt", base64: Buffer.from("yo").toString("base64"), actor: { source: "cli" } })
    await store.DeleteDocPage({ docPage: page.id, actor: { source: "cli" } })
    const M = store.models.DocPageAttachment
    assert.equal(await M.count({ where: { projectId: proj.id, deletedAt: null } }), 0)
})

test("anexo de página em projeto arquivado é somente leitura", async () => {
    const proj = await store.CreateProject({ name: "Docs Anexo RO", actor: { source: "cli" } })
    const page = await store.CreateDocPage({ project: proj.id, title: "P", actor: { source: "cli" } })
    const att = await store.AddDocPageBufferAttachment({ docPage: page.id, name: "a.txt", base64: Buffer.from("x").toString("base64"), actor: { source: "cli" } })

    await store.ArchiveProject({ project: proj.id, actor: { source: "cli" } })
    const archived = (e) => e.code === "PROJECT_ARCHIVED"
    await assert.rejects(() => store.AddDocPageBufferAttachment({ docPage: page.id, name: "b.txt", base64: Buffer.from("y").toString("base64") }), archived)
    await assert.rejects(() => store.AddDocPageLinkAttachment({ docPage: page.id, url: "https://x.dev" }), archived)
    await assert.rejects(() => store.RemoveDocPageAttachment({ attachment: att.id, actor: { source: "cli" } }), archived)

    // Leitura segue liberada.
    assert.equal((await store.ListDocPageAttachments({ docPage: page.id })).length, 1)
})

// ---- Exportação da documentação inteira (HTML + .zip) ----

test("export da documentação: HTML autocontido e .zip (markdown em árvore + anexos ligados)", async () => {
    const proj = await store.CreateProject({ name: "Export Docs", actor: { source: "cli" } })
    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    const guia = await store.CreateDocPage({ project: proj.id, title: "Guia do Usuário", icon: "📘",
        body: `Intro **negrito**.\n\n![diagrama](data:image/png;base64,${tinyPng})`, actor: { source: "cli" } })
    const setup = await store.CreateDocPage({ project: proj.id, parentId: guia.id, title: "Configuração / Setup", body: "## Passos", actor: { source: "cli" } })
    await store.CreateDocPage({ project: proj.id, title: "Referência", body: "conteúdo", actor: { source: "cli" } })
    await store.AddDocPageBufferAttachment({ docPage: guia.id, name: "icone.svg", base64: Buffer.from("<svg/>").toString("base64"), mimeType: "image/svg+xml", actor: { source: "cli" } })
    await store.AddDocPageLinkAttachment({ docPage: setup.id, url: "https://example.com/x", name: "ref", actor: { source: "cli" } })

    // HTML: um arquivo, com sumário, imagem embutida e sem <script>.
    const html = await store.ExportDocsHtml({ project: proj.id })
    assert.match(html.filename, /\.html$/)
    assert.ok(html.html.includes("Sumário"))
    assert.ok(html.html.includes("data:image/png"))         // imagem do corpo embutida
    assert.ok(html.html.includes("Guia do Usuário"))
    assert.ok(!/<script/i.test(html.html))                   // scrub

    // Archive: .zip válido com README + páginas em árvore + assets extraídos.
    const arc = await store.ExportDocsArchive({ project: proj.id })
    assert.match(arc.filename, /\.zip$/)
    assert.equal(arc.mimeType, "application/zip")
    const zip = Buffer.from(arc.base64, "base64")
    // Assinatura local file header (PK\x03\x04) e end-of-central-directory (PK\x05\x06).
    assert.equal(zip.readUInt32LE(0), 0x04034b50)
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50)
    // O nome da imagem extraída aparece na tabela de nomes do zip.
    const asText = zip.toString("latin1")
    assert.ok(asText.includes("README.md"))
    assert.ok(asText.includes(`_assets/${guia.id}/img-1.png`))
    assert.ok(asText.includes(`_assets/${guia.id}/files/icone.svg`))
    assert.ok(asText.includes("index.md"))                   // página com filhos

    // Export continua disponível em projeto arquivado (é só leitura).
    await store.ArchiveProject({ project: proj.id, actor: { source: "cli" } })
    const htmlArch = await store.ExportDocsHtml({ project: proj.id })
    assert.ok(htmlArch.html.includes("Referência"))
})

// ---- Trava de PLANEJAMENTO (store do MCP: agentPlanningLock) ----

test("trava de planejamento (flag do MCP): TODA escrita em projeto 'planning' é recusada; ativo libera", async () => {
    const TMP2 = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-plock-${process.pid}`)
    fs.mkdirSync(TMP2, { recursive: true })
    const DB = path.join(TMP2, "s.sqlite"), ATT = path.join(TMP2, "att")

    // Store de SETUP (sem flag = humano/GUI): monta os dados em planejamento livremente.
    const setup = InitializeProjectStore({ storage: DB, attachmentsDirPath: ATT, onEvent: () => {} })
    await setup.ConnectAndSync()
    const proj = await setup.CreateProject({ name: "Plan Flag", actor: { source: "cli" } }) // planning
    assert.equal(proj.status, "planning")
    const item = await setup.CreateItem({ project: proj.id, type: "task", title: "base" })
    const active = await setup.CreateProject({ name: "Ativo", status: "active", actor: { source: "cli" } })

    // Store do MCP (flag ligado): TODA escrita no projeto em planning é recusada,
    // cobrindo tipos de escrita diferentes (create/update/status/comment) — a trava
    // vive no AssertProjectWritable, no topo de toda escrita.
    const mcp = InitializeProjectStore({ storage: DB, attachmentsDirPath: ATT, agentPlanningLock: true, onEvent: () => {} })
    await mcp.ConnectAndSync()
    const planning = (e) => e.code === "PROJECT_IN_PLANNING"
    await assert.rejects(() => mcp.CreateItem({ project: proj.id, type: "task", title: "X" }), planning)
    await assert.rejects(() => mcp.UpdateItem({ item: item.id, title: "novo" }), planning)
    await assert.rejects(() => mcp.SetStatus({ item: item.id, status: "ready" }), planning)
    await assert.rejects(() => mcp.AddComment({ item: item.id, body: "oi" }), planning)

    // Leitura segue liberada mesmo com o flag.
    assert.ok((await mcp.GetItem({ item: item.id })).id)

    // Projeto ATIVO: o mesmo store do MCP escreve normalmente.
    const ok = await mcp.CreateItem({ project: active.id, type: "task", title: "OK agora" })
    assert.ok(ok.key)

    // Humano (store sem flag) escreve no projeto em planning sem obstáculo.
    const byHuman = await setup.CreateItem({ project: proj.id, type: "task", title: "humano no plano" })
    assert.ok(byHuman.key)
})

// ───────────── MPMX2: modelo consultável (rodada 2) ─────────────

test("MPMX2-7/8 item aceita shortDescription, effort e confidence; shortDescription tem limite", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Modelo", keyPrefix: "X2A", actor: { source: "cli" } })
    const item = await store.CreateItem({
        project: p.id, type: "task", title: "Com resumo",
        shortDescription: "Uma linha que o humano lê no card.",
        effort: "l", confidence: "medium", value: "high"
    })
    assert.equal(item.shortDescription, "Uma linha que o humano lê no card.")
    assert.equal(item.effort, "l")
    assert.equal(item.confidence, "medium")

    const updated = await store.UpdateItem({ item: item.id, shortDescription: "Outra linha.", confidence: "high" })
    assert.equal(updated.shortDescription, "Outra linha.")
    assert.equal(updated.confidence, "high")

    // O limite é o MESMO de projeto/board/entrega (240).
    await assert.rejects(
        () => store.CreateItem({ project: p.id, type: "task", title: "Longo", shortDescription: "x".repeat(241) }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.field === "shortDescription")
    // Confiança fora da escala não passa em silêncio.
    await assert.rejects(
        () => store.CreateItem({ project: p.id, type: "task", title: "Conf", confidence: "talvez" }),
        (e) => e.code === "VALIDATION_ERROR")
})

test("MPMX2-3 labels são normalizados, filtráveis e viram vocabulário do projeto", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Labels", keyPrefix: "X2B", actor: { source: "cli" } })
    const a = await store.CreateItem({ project: p.id, type: "task", title: "Com rótulos", labels: ["agente:senior", " trilha:iam ", "agente:senior"] })
    // duplicata e espaços saem; a 1ª grafia fica
    assert.deepEqual(a.labels, ["agente:senior", "trilha:iam"])
    await store.CreateItem({ project: p.id, type: "task", title: "Outro", labels: "trilha:iam,agente:standard" })

    const filtrados = await store.ListItems({ project: p.id, label: "trilha:iam" })
    assert.equal(filtrados.length, 2)
    const senior = await store.ListItems({ project: p.id, label: "agente:senior" })
    assert.equal(senior.length, 1)
    assert.equal(senior[0].key, a.key)

    const vocab = await store.ListProjectLabels({ project: p.id })
    const trilha = vocab.find((l) => l.label === "trilha:iam")
    assert.equal(trilha.count, 2)
    // o mais usado vem primeiro
    assert.equal(vocab[0].label, "trilha:iam")

    // update SUBSTITUI a lista
    const semRotulo = await store.UpdateItem({ item: a.id, labels: [] })
    assert.deepEqual(semRotulo.labels, [])
})

test("MPMX2-3 filtro por rótulo é literal: não casa prefixo, aspas nem curinga", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Filtro", keyPrefix: "X2M", actor: { source: "cli" } })
    await store.CreateItem({ project: p.id, type: "task", title: "gateway", labels: ["api-gateway"] })
    const aspas = await store.CreateItem({ project: p.id, type: "task", title: "esquisito", labels: ['tem"aspas'] })

    // prefixo não casa: "api" e "api-gateway" são rótulos diferentes
    assert.equal((await store.ListItems({ project: p.id, label: "api" })).length, 0)
    assert.equal((await store.ListItems({ project: p.id, label: "api-gateway" })).length, 1)
    // aspas no rótulo continuam encontráveis
    const achado = await store.ListItems({ project: p.id, label: 'tem"aspas' })
    assert.equal(achado.length, 1)
    assert.equal(achado[0].key, aspas.key)
    // curinga de LIKE é dado, não padrão: "%" não devolve tudo
    assert.equal((await store.ListItems({ project: p.id, label: "%" })).length, 0)
    assert.equal((await store.ListItems({ project: p.id, label: "_" })).length, 0)
})

test("MPMX2-12 área adota a grafia já usada no projeto (Rede/rede não viram duas trilhas)", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Areas", keyPrefix: "X2C", actor: { source: "cli" } })
    await store.CreateItem({ project: p.id, type: "task", title: "primeiro", area: "Rede" })
    const segundo = await store.CreateItem({ project: p.id, type: "task", title: "segundo", area: "rede" })
    assert.equal(segundo.area, "Rede")
    const terceiro = await store.CreateItem({ project: p.id, type: "task", title: "terceiro", area: " REDE " })
    assert.equal(terceiro.area, "Rede")
    // update segue a mesma regra
    const quarto = await store.CreateItem({ project: p.id, type: "task", title: "quarto" })
    assert.equal((await store.UpdateItem({ item: quarto.id, area: "rede" })).area, "Rede")

    const areas = await store.ListProjectAreas({ project: p.id })
    assert.equal(areas.length, 1)
    assert.equal(areas[0].area, "Rede")
    assert.equal(areas[0].count, 4)
    // área nova continua livre
    const outra = await store.CreateItem({ project: p.id, type: "task", title: "quinto", area: "Storage" })
    assert.equal(outra.area, "Storage")
})

test("MPMX2-9 risco ↔ item: vínculo navegável dos dois lados", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Riscos", keyPrefix: "X2D", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Runner de migrations idempotente" })
    const risk = await store.CreateRisk({ project: p.id, title: "Migração quebra a base", probability: "medium", impact: "high" })

    const link = await store.LinkRiskItem({ risk: risk.id, item: item.key, relation: "mitigates", note: "endereça a migração" })
    assert.equal(link.relation, "mitigates")
    assert.equal(link.itemKey, item.key)

    // do lado do item
    const fullItem = await store.GetItem({ item: item.key })
    assert.equal(fullItem.risks.length, 1)
    assert.equal(fullItem.risks[0].riskTitle, "Migração quebra a base")
    assert.equal(fullItem.risks[0].riskLevel, "high")
    // do lado do risco
    const fullRisk = await store.GetRisk({ risk: risk.id })
    assert.equal(fullRisk.items.length, 1)
    assert.equal(fullRisk.items[0].itemKey, item.key)
    // filtro por item
    assert.equal((await store.ListRisks({ project: p.id, item: item.key })).length, 1)

    // repetir o vínculo não duplica
    await store.LinkRiskItem({ risk: risk.id, item: item.key, relation: "mitigates" })
    assert.equal((await store.ListRiskItems({ risk: risk.id })).length, 1)

    // relação inválida e projeto cruzado são recusados
    await assert.rejects(() => store.LinkRiskItem({ risk: risk.id, item: item.key, relation: "cura" }), (e) => e.code === "VALIDATION_ERROR")
    const outro = await store.CreateProject({ name: "MPMX2 Outro", keyPrefix: "X2E", actor: { source: "cli" } })
    const alheio = await store.CreateItem({ project: outro.id, type: "task", title: "de outro projeto" })
    await assert.rejects(() => store.LinkRiskItem({ risk: risk.id, item: alheio.key }), (e) => e.code === "VALIDATION_ERROR")

    assert.equal((await store.UnlinkRiskItem({ risk: risk.id, item: item.key })).removed, 1)
    assert.equal((await store.GetItem({ item: item.key })).risks.length, 0)
})

test("MPMX2-10 dependência entre entregas: ciclo recusado, roadmap topológico, dependenciesMet", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Fases", keyPrefix: "X2F", status: "active", actor: { source: "cli" } })
    // datas propositalmente FORA da ordem de dependência: a dependência manda.
    const f1 = await store.CreateMilestone({ project: p.id, name: "F1", targetDate: "2026-12-01" })
    const f2 = await store.CreateMilestone({ project: p.id, name: "F2", targetDate: "2026-09-01" })
    const f3 = await store.CreateMilestone({ project: p.id, name: "F3", targetDate: "2026-10-01" })

    await store.LinkMilestones({ milestone: f2.id, relation: "depends", target: f1.id })
    await store.LinkMilestones({ milestone: f1.id, relation: "blocks", target: f3.id })   // F3 precisa de F1

    // ciclo direto e indireto
    await assert.rejects(() => store.LinkMilestones({ milestone: f1.id, relation: "depends", target: f2.id }), (e) => e.code === "VALIDATION_ERROR")
    await assert.rejects(() => store.LinkMilestones({ milestone: f1.id, relation: "depends", target: f1.id }), (e) => e.code === "VALIDATION_ERROR")

    const roadmap = await store.Roadmap({ project: p.id })
    const ordem = roadmap.map((m) => m.name)
    assert.ok(ordem.indexOf("F1") < ordem.indexOf("F2"), "F1 precisa vir antes de F2")
    assert.ok(ordem.indexOf("F1") < ordem.indexOf("F3"), "F1 precisa vir antes de F3")

    const lista = await store.ListMilestones({ project: p.id })
    const dF2 = lista.find((m) => m.name === "F2")
    assert.deepEqual(dF2.dependsOn.map((d) => d.name), ["F1"])
    assert.equal(dF2.dependenciesMet, false)
    assert.deepEqual(dF2.pendingDependencies, ["F1"])
    assert.deepEqual(lista.find((m) => m.name === "F1").blocks.map((d) => d.name).sort(), ["F2", "F3"])

    // entregue a F1, as dependentes ficam liberadas
    await store.UpdateMilestone({ milestone: f1.id, status: "released" })
    assert.equal((await store.ListMilestones({ project: p.id })).find((m) => m.name === "F2").dependenciesMet, true)

    // remover a entrega leva as arestas junto
    await store.DeleteMilestone({ milestone: f3.id, actor: { source: "cli" } })
    assert.deepEqual((await store.ListMilestones({ project: p.id })).find((m) => m.name === "F1").blocks.map((d) => d.name), ["F2"])
})

test("MPMX2-8 entrega agrega esforço e confiança (capacidade, não só contagem)", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Capacidade", keyPrefix: "X2G", status: "active", actor: { source: "cli" } })
    const m = await store.CreateMilestone({ project: p.id, name: "Fase única" })
    const grande = await store.CreateItem({ project: p.id, type: "task", title: "grande", effort: "xl", confidence: "low", milestoneId: m.id })
    await store.CreateItem({ project: p.id, type: "task", title: "pequena", effort: "xs", confidence: "high", milestoneId: m.id })
    await store.CreateItem({ project: p.id, type: "task", title: "sem estimativa", milestoneId: m.id })

    let detalhe = await store.GetMilestone({ milestone: m.id })
    assert.equal(detalhe.effort.total, 9)          // xl(8) + xs(1)
    assert.equal(detalhe.effort.estimated, 2)
    assert.equal(detalhe.effort.unestimated, 1)
    assert.equal(detalhe.confidence.low, 1)
    assert.equal(detalhe.confidence.high, 1)
    assert.equal(detalhe.confidence.unset, 1)
    assert.equal(detalhe.effortProgress, 0)

    await store.SetStatus({ item: grande.id, status: "done", actor: { source: "cli" } })
    detalhe = await store.GetMilestone({ milestone: m.id })
    // por CONTAGEM 1/3 = 33%; por ESFORÇO 8/9 = 89% — a diferença é o ponto do campo
    assert.equal(detalhe.progress, 33)
    assert.equal(detalhe.effortProgress, 89)
    assert.equal(detalhe.effort.remaining, 1)
})

test("MPMX2-11 report_ready: só o desimpedido, ordenado por quanto destrava", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Prontidão", keyPrefix: "X2H", status: "active", actor: { source: "cli" } })
    const base = await store.CreateItem({ project: p.id, type: "task", title: "Fundação", priority: "medium" })
    const dependente = await store.CreateItem({ project: p.id, type: "task", title: "Depende da fundação" })
    const outra = await store.CreateItem({ project: p.id, type: "task", title: "Depende também" })
    const solta = await store.CreateItem({ project: p.id, type: "task", title: "Livre", priority: "urgent" })
    const travada = await store.CreateItem({ project: p.id, type: "task", title: "Bloqueada" })
    await store.SetBlocked({ item: travada.id, reason: "aguardando decisão" })

    await store.LinkItem({ item: dependente.id, relation: "depends", target: base.id })
    await store.LinkItem({ item: base.id, relation: "blocks", target: outra.id })

    let pronto = await store.Ready({ project: p.id })
    let keys = pronto.map((i) => i.key)
    assert.ok(!keys.includes(dependente.key), "quem depende de item aberto não está pronto")
    assert.ok(!keys.includes(outra.key), "quem é bloqueado por item aberto não está pronto")
    assert.ok(!keys.includes(travada.key), "item bloqueado não está pronto")
    // a fundação destrava 2 e vem antes da urgente que não destrava ninguém
    assert.equal(keys[0], base.key)
    assert.equal(pronto[0].unblocks, 2)
    assert.deepEqual(pronto[0].unblocksKeys.sort(), [dependente.key, outra.key].sort())
    assert.ok(keys.includes(solta.key))

    // concluída a fundação, as duas dependentes entram
    await store.SetStatus({ item: base.id, status: "done", actor: { source: "cli" } })
    keys = (await store.Ready({ project: p.id })).map((i) => i.key)
    assert.ok(keys.includes(dependente.key) && keys.includes(outra.key))
})

test("MPMX2-11 report_ready enxerga dependência que CRUZA projetos", async () => {
    const a = await store.CreateProject({ name: "Prontidão Cross A", keyPrefix: "X2P", status: "active", actor: { source: "cli" } })
    const b = await store.CreateProject({ name: "Prontidão Cross B", keyPrefix: "X2Q", status: "active", actor: { source: "cli" } })
    const externo = await store.CreateItem({ project: b.id, type: "task", title: "fundação em outro projeto" })
    const nosso = await store.CreateItem({ project: a.id, type: "task", title: "depende de fora" })
    await store.LinkItem({ item: nosso.id, relation: "depends", target: externo.id })

    assert.equal((await store.Ready({ project: a.id })).length, 0, "dependência externa aberta não pode ser ignorada")
    await store.SetStatus({ item: externo.id, status: "done", actor: { source: "cli" } })
    assert.deepEqual((await store.Ready({ project: a.id })).map((i) => i.key), [nosso.key])
})

test("MPMX2-11 report_ready respeita a dependência entre entregas", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Prontidão Fase", keyPrefix: "X2I", status: "active", actor: { source: "cli" } })
    const f1 = await store.CreateMilestone({ project: p.id, name: "Fase 1" })
    const f2 = await store.CreateMilestone({ project: p.id, name: "Fase 2" })
    await store.LinkMilestones({ milestone: f2.id, relation: "depends", target: f1.id })
    const naFase1 = await store.CreateItem({ project: p.id, type: "task", title: "na fase 1", milestoneId: f1.id })
    const naFase2 = await store.CreateItem({ project: p.id, type: "task", title: "na fase 2", milestoneId: f2.id })

    const keys = (await store.Ready({ project: p.id })).map((i) => i.key)
    assert.ok(keys.includes(naFase1.key))
    assert.ok(!keys.includes(naFase2.key), "item de entrega travada não está pronto")
})

test("MPMX2-13 convert_idea leva a triagem para o item criado", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Ideias", keyPrefix: "X2J", status: "active", actor: { source: "cli" } })
    const m = await store.CreateMilestone({ project: p.id, name: "Fase provável" })
    const ideia = await store.CreateItem({
        project: p.id, type: "task", title: "Ideia crua", horizon: "inbox", clarityState: "idea",
        shortDescription: "resumo da ideia", value: "high", effort: "m", confidence: "low",
        labels: ["trilha:ux"], area: "UX", milestoneId: m.id
    })
    const { created, idea } = await store.ConvertIdea({ item: ideia.id, type: "feature" })
    assert.equal(created.value, "high")
    assert.equal(created.effort, "m")
    assert.equal(created.confidence, "low")
    assert.deepEqual(created.labels, ["trilha:ux"])
    assert.equal(created.milestoneId, m.id)
    assert.equal(created.shortDescription, "resumo da ideia")
    assert.equal(idea.horizon, "archived")
})

test("MPMX2-13 inbox ordena por triagem (mais valor, menos esforço)", async () => {
    const p = await store.CreateProject({ name: "MPMX2 Triagem", keyPrefix: "X2K", status: "active", actor: { source: "cli" } })
    const base = { project: p.id, type: "task", horizon: "inbox", clarityState: "idea" }
    await store.CreateItem({ ...base, title: "média/cara", value: "medium", effort: "xl" })
    const joia = await store.CreateItem({ ...base, title: "alta/barata", value: "high", effort: "xs" })
    await store.CreateItem({ ...base, title: "alta/cara", value: "high", effort: "l" })

    const ordenado = await store.ListItems({ project: p.id, horizon: "inbox", sort: "triage" })
    assert.equal(ordenado[0].key, joia.key)
    assert.equal(ordenado[ordenado.length - 1].title, "média/cara")
})

test("MPMX2-6 política de gate é a fonte única: criar entrega é livre, remover é gated", async () => {
    const policy = store.AgentGatePolicy()
    assert.deepEqual(policy.actions.create, ["project", "board", "column"])
    assert.ok(policy.actions.delete.includes("milestone"))
    assert.deepEqual(policy.statuses.start, ["in-progress"])

    const p = await store.CreateProject({ name: "MPMX2 Gate", keyPrefix: "X2L", status: "active", actor: { source: "cli" } })
    const agente = { source: "agent", session: { provider: "claude", model: "opus", traceId: "X2-GATE" } }
    // criar entrega/sprint por AGENTE não vira pedido pendente
    const m = await store.CreateMilestone({ project: p.id, name: "Livre", actor: agente })
    assert.ok(m.id)
    const s = await store.CreateSprint({ project: p.id, name: "Sprint livre", actor: agente })
    assert.ok(s.id)
    // remover, sim
    await assert.rejects(() => store.DeleteMilestone({ milestone: m.id, actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
})

test("MPMX2-16 estado do índice de pacotes é leitura pura e diz o que falta indexar", async () => {
    const TMP3 = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-eco-${process.pid}`)
    const repo = path.join(TMP3, "R", "A.Module", "B.layer", "G.group", "x.lib")
    fs.mkdirSync(path.join(repo, "metadata"), { recursive: true })
    fs.writeFileSync(path.join(repo, "metadata", "package.json"), "{}")
    fs.writeFileSync(path.join(TMP3, "repositories.json"), JSON.stringify({ R: { installationPath: path.join(TMP3, "R") } }))

    const eco = InitializeProjectStore({ storage: path.join(TMP3, "s.sqlite"), attachmentsDirPath: path.join(TMP3, "att"), ecosystemDataPath: TMP3 })
    await eco.ConnectAndSync()

    const antes = await eco.EcosystemIndexStatus()
    assert.equal(antes.indexed, false)
    assert.equal(antes.totalPackages, 0)
    assert.deepEqual(antes.notIndexedRepositories, ["R"])

    await eco.IndexEcosystemPackages({ actor: { source: "cli" } })
    const depois = await eco.EcosystemIndexStatus()
    assert.equal(depois.indexed, true)
    assert.equal(depois.totalPackages, 1)
    assert.equal(depois.byRepository.R, 1)
    assert.equal(depois.byType.lib, 1)
    assert.ok(depois.lastIndexedAt)
    assert.deepEqual(depois.notIndexedRepositories, [])
})

// ───────────── MPMX3: sair do planejamento e enxergar o pedido (rodada 3) ─────────────

test("MPMX3-4 trava de planejamento libera SÓ a mudança de status do projeto", async () => {
    const TMP4 = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-plock3-${process.pid}`)
    fs.mkdirSync(TMP4, { recursive: true })
    const DB = path.join(TMP4, "s.sqlite"), ATT = path.join(TMP4, "att")

    const setup = InitializeProjectStore({ storage: DB, attachmentsDirPath: ATT, onEvent: () => {} })
    await setup.ConnectAndSync()
    const proj = await setup.CreateProject({ name: "Sai do Plano", actor: { source: "cli" } })
    assert.equal(proj.status, "planning")

    const mcp = InitializeProjectStore({ storage: DB, attachmentsDirPath: ATT, agentPlanningLock: true, onEvent: () => {} })
    await mcp.ConnectAndSync()
    const planning = (e) => e.code === "PROJECT_IN_PLANNING"

    // Só-status passa (é o que destrava o projeto).
    const ativo = await mcp.UpdateProject({ project: proj.id, status: "active", actor: { source: "cli" } })
    assert.equal(ativo.status, "active")

    // Status JUNTO com outro campo não é "destravar": continua recusado.
    const outro = await setup.CreateProject({ name: "Segue no Plano", actor: { source: "cli" } })
    await assert.rejects(() => mcp.UpdateProject({ project: outro.id, status: "active", name: "Renomeado" }), planning)
    // E nenhuma outra escrita foi liberada de carona.
    await assert.rejects(() => mcp.UpdateProject({ project: outro.id, description: "texto" }), planning)
    await assert.rejects(() => mcp.CreateItem({ project: outro.id, type: "task", title: "X" }), planning)
})

test("MPMX3-7 pedido de aprovação descreve o alvo pelo nome e o de-para da ação", async () => {
    const p = await store.CreateProject({ name: "Gate Legível", keyPrefix: "GTL", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Tarefa observada" })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "t-gate-1" } }

    // Iniciar tarefa por agente = pedido pendente.
    await assert.rejects(() => store.SetStatus({ item: item.id, status: "in-progress", actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")

    const [pedido] = await store.ListCreationRequests({ actionName: "set-status", status: "pending" })
    assert.ok(pedido.subject, "todo pedido com alvo traz o assunto")
    assert.equal(pedido.subject.label, `${item.key} · Tarefa observada`)
    assert.equal(pedido.subject.projectLabel, "GTL · Gate Legível")
    assert.deepEqual(pedido.subject.changes, [{ field: "statusKey", from: "backlog", to: "in-progress" }])

    // O mesmo vale no detalhe de um pedido.
    const detalhe = await store.DescribeCreationRequest({ request: pedido.id })
    assert.equal(detalhe.subject.label, `${item.key} · Tarefa observada`)

    // Ação sem payload (arquivar projeto) também tem de-para.
    await assert.rejects(() => store.ArchiveProject({ project: p.id, actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const [arquivar] = await store.ListCreationRequests({ actionName: "archive", status: "pending" })
    assert.equal(arquivar.subject.label, "GTL · Gate Legível")
    assert.deepEqual(arquivar.subject.changes, [{ field: "status", from: "active", to: "archived" }])
})

// ───────────── MPME: execução, rodadas e visões agregadoras ─────────────

test("MPME-6/7 ExecutionOverview separa em execução, fila, bloqueado e concluído da rodada", async () => {
    const p = await store.CreateProject({ name: "Execucao", keyPrefix: "EXE", status: "active", actor: { source: "cli" } })
    const rodada = await store.CreateSprint({ project: p.id, name: "Rodada 1", status: "active", actor: { source: "cli" } })

    const emCurso = await store.CreateItem({ project: p.id, type: "task", title: "Fazendo" })
    const naFila  = await store.CreateItem({ project: p.id, type: "task", title: "Livre para pegar" })
    const travado = await store.CreateItem({ project: p.id, type: "task", title: "Travado" })
    const pronto  = await store.CreateItem({ project: p.id, type: "task", title: "Já entregue" })
    const dependente = await store.CreateItem({ project: p.id, type: "task", title: "Depende do travado" })

    await store.SetStatus({ item: emCurso.id, status: "in-progress" })
    await store.SetBlocked({ item: travado.id, reason: "esperando terceiro" })
    await store.LinkItem({ item: dependente.id, relation: "depends", target: travado.id })
    await store.AssignItemPlanning({ item: pronto.id, sprint: rodada.id })
    await store.SetStatus({ item: pronto.id, status: "done" })

    const view = await store.ExecutionOverview({ project: p.id })
    assert.equal(view.round.id, rodada.id, "usa a rodada ativa como recorte")
    assert.deepEqual(view.now.map((i) => i.id), [emCurso.id])
    assert.deepEqual(view.blocked.map((i) => i.id), [travado.id])
    assert.deepEqual(view.doneInRound.map((i) => i.id), [pronto.id])
    // Na fila entra o que está livre; o que depende de item aberto NÃO entra.
    const filaIds = view.queue.map((i) => i.id)
    assert.ok(filaIds.includes(naFila.id), "item sem dependência está na fila")
    assert.ok(!filaIds.includes(dependente.id), "item que depende de aberto fica fora da fila")
    assert.ok(!filaIds.includes(travado.id), "bloqueado fica fora da fila")
    assert.equal(view.counts.now, 1)
    assert.equal(view.counts.blocked, 1)
})

test("MPME-13 ItemTimeline reconstrói início e fim reais do audit log", async () => {
    const p = await store.CreateProject({ name: "Linha do tempo", keyPrefix: "LTP", status: "active", actor: { source: "cli" } })
    const feito = await store.CreateItem({ project: p.id, type: "task", title: "Começou e terminou" })
    const andando = await store.CreateItem({ project: p.id, type: "task", title: "Só começou" })
    await store.CreateItem({ project: p.id, type: "task", title: "Nunca começou" })

    await store.SetStatus({ item: feito.id, status: "in-progress" })
    await store.SetStatus({ item: feito.id, status: "done" })
    await store.SetStatus({ item: andando.id, status: "in-progress" })

    const timeline = await store.ItemTimeline({ project: p.id })
    assert.equal(timeline.hasData, true)
    const byId = {}
    timeline.items.forEach((i) => { byId[i.id] = i })

    assert.ok(byId[feito.id].actualStart, "concluído tem início real")
    assert.ok(byId[feito.id].actualEnd, "concluído tem fim real")
    assert.equal(byId[feito.id].inProgress, false)

    assert.ok(byId[andando.id].actualStart)
    assert.equal(byId[andando.id].actualEnd, null, "em curso não tem fim")
    assert.equal(byId[andando.id].inProgress, true)

    // Item que nunca saiu do backlog não vira barra (lacuna honesta).
    assert.equal(timeline.items.length, 2)
    assert.equal(timeline.totalItems, 3)
})

test("MPME-4 entrega e rodada expõem o andamento DERIVADO dos itens", async () => {
    const p = await store.CreateProject({ name: "Derivado", keyPrefix: "DRV", status: "active", actor: { source: "cli" } })
    const entrega = await store.CreateMilestone({ project: p.id, name: "F1", actor: { source: "cli" } })
    const rodada = await store.CreateSprint({ project: p.id, name: "R1", actor: { source: "cli" } })

    // Entrega sem item: "empty" — e não "planejamento" para sempre.
    let ms = await store.ListMilestones({ project: p.id })
    assert.equal(ms[0].derivedStatus, "empty")

    const a = await store.CreateItem({ project: p.id, type: "task", title: "A" })
    const b = await store.CreateItem({ project: p.id, type: "task", title: "B" })
    await store.AssignItemPlanning({ item: a.id, milestone: entrega.id, sprint: rodada.id })
    await store.AssignItemPlanning({ item: b.id, milestone: entrega.id, sprint: rodada.id })

    ms = await store.ListMilestones({ project: p.id })
    assert.equal(ms[0].derivedStatus, "planned", "com itens parados, ainda não começou")

    await store.SetStatus({ item: a.id, status: "in-progress" })
    ms = await store.ListMilestones({ project: p.id })
    assert.equal(ms[0].derivedStatus, "active")
    let sp = await store.ListSprints({ project: p.id })
    assert.equal(sp[0].derivedStatus, "active")

    await store.SetStatus({ item: a.id, status: "done" })
    await store.SetStatus({ item: b.id, status: "done" })
    ms = await store.ListMilestones({ project: p.id })
    sp = await store.ListSprints({ project: p.id })
    assert.equal(ms[0].derivedStatus, "completed")
    assert.equal(sp[0].derivedStatus, "completed")
    // O status declarado continua o que era: derivado não sobrescreve intenção.
    assert.equal(ms[0].status, "planning")
})

// ───────────── MPME: identidade do agente (entrada e modelo) ─────────────

test("MPME-28/29 sessão nova entra pendente, só lê, declara identidade e é liberada com correção", async () => {
    const TMP5 = path.join(process.env.MPM_TEST_DIR || os.tmpdir(), `mpm-sessao-${process.pid}`)
    fs.mkdirSync(TMP5, { recursive: true })
    const DB = path.join(TMP5, "s.sqlite"), ATT = path.join(TMP5, "att")

    // Store do MCP: exige liberação de entrada (como o runtime do servidor).
    const mcp = InitializeProjectStore({ storage: DB, attachmentsDirPath: ATT, requireSessionApproval: true, onEvent: () => {} })
    await mcp.ConnectAndSync()
    // Store humano (GUI/CLI): sem o flag — é quem libera.
    const humano = InitializeProjectStore({ storage: DB, attachmentsDirPath: ATT, onEvent: () => {} })
    await humano.ConnectAndSync()

    const projeto = await humano.CreateProject({ name: "Portao", keyPrefix: "PRT", status: "active", actor: { source: "cli" } })

    // A configuração do cliente mente sobre o modelo (é o caso real: opus-4 numa sessão opus-5).
    const agente = { source: "agent", session: { provider: "claude", model: "claude-opus-4", traceId: "sessao-nova-1", host: "h", pid: 42 } }

    // 1. A entrada nasce pendente e a escrita é recusada.
    await assert.rejects(() => mcp.AssertSessionApproved({ actor: agente, action: "create_item" }),
        (e) => e.code === "AGENT_SESSION_PENDING_APPROVAL")

    // 2. Leitura continua livre (é o que o agente deve fazer enquanto espera).
    assert.ok((await mcp.GetProject({ project: projeto.id })).id)

    // 3. O agente declara quem É de fato.
    const declarada = await mcp.DeclareSession({ actor: agente, provider: "claude", model: "claude-opus-5", objective: "implementar PRT-1" })
    assert.equal(declarada.modelName, "claude-opus-5", "a declaração corrige o que a configuração errou")
    assert.equal(declarada.status, "pending_confirmation", "declarar não libera — quem libera é o humano")

    // 4. O humano vê a sessão pendente e libera, corrigindo o provedor.
    const [pendente] = await humano.ListSessions({ status: "pending_confirmation" })
    assert.equal(pendente.id, declarada.id)
    const liberada = await humano.ConfirmSession({ session: pendente.id, model: "claude-opus-5.1", actor: { source: "gui" } })
    assert.equal(liberada.status, "active")
    assert.equal(liberada.modelName, "claude-opus-5.1", "a correção do humano vale para a sessão inteira")

    // 5. Agora a escrita passa.
    assert.ok(await mcp.AssertSessionApproved({ actor: agente, action: "create_item" }))
    const item = await mcp.CreateItem({ project: projeto.id, type: "task", title: "agora pode", actor: agente })
    assert.ok(item.key)

    // 6. Sessão recusada não escreve mais.
    const outro = { source: "agent", session: { provider: "codex", model: "gpt-6", traceId: "sessao-nova-2" } }
    await assert.rejects(() => mcp.AssertSessionApproved({ actor: outro, action: "create_item" }),
        (e) => e.code === "AGENT_SESSION_PENDING_APPROVAL")
    const [pendente2] = await humano.ListSessions({ status: "pending_confirmation" })
    await humano.RejectSession({ session: pendente2.id, actor: { source: "gui" } })
    await assert.rejects(() => mcp.AssertSessionApproved({ actor: outro, action: "create_item" }),
        (e) => e.code === "AGENT_SESSION_REJECTED")
})

test("MPME-30 concluir épico fecha os filhos abertos numa autorização só", async () => {
    const p = await store.CreateProject({ name: "Epico", keyPrefix: "EPC", status: "active", actor: { source: "cli" } })
    const epico = await store.CreateItem({ project: p.id, type: "epic", title: "E1" })
    const f1 = await store.CreateItem({ project: p.id, type: "feature", title: "F1", parent: epico.id })
    const f2 = await store.CreateItem({ project: p.id, type: "feature", title: "F2", parent: epico.id })
    const sub = await store.CreateItem({ project: p.id, type: "task", title: "T1", parent: f1.id })
    await store.SetStatus({ item: f2.id, status: "done" })   // já concluído antes

    const resultado = await store.CompleteEpic({ item: epico.id, actor: { source: "cli" } })

    assert.equal((await store.GetItem({ item: epico.id })).statusKey, "done")
    assert.equal((await store.GetItem({ item: f1.id })).statusKey, "done")
    assert.equal((await store.GetItem({ item: sub.id })).statusKey, "done", "conclui em profundidade")
    assert.equal(resultado.totalChildren, 3)
    assert.deepEqual(resultado.completedChildren.sort(), [f1.key, sub.key].sort(), "só os que estavam abertos")

    // Por AGENTE: vira UM pedido, e o pedido diz o que será concluído junto.
    const p2 = await store.CreateProject({ name: "Epico Gate", keyPrefix: "EPG", status: "active", actor: { source: "cli" } })
    const e2 = await store.CreateItem({ project: p2.id, type: "epic", title: "E2" })
    await store.CreateItem({ project: p2.id, type: "task", title: "T-a", parent: e2.id })
    await store.CreateItem({ project: p2.id, type: "task", title: "T-b", parent: e2.id })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "epico-1" } }
    await assert.rejects(() => store.CompleteEpic({ item: e2.id, actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")

    const [pedido] = await store.ListCreationRequests({ actionName: "complete-epic", status: "pending" })
    assert.equal(pedido.subject.children.length, 2, "o pedido lista os filhos")
    assert.equal(pedido.subject.childrenOpen.length, 2, "e destaca os que ainda estão abertos")

    // Aprovar executa tudo de uma vez.
    await store.ApproveRequest({ request: pedido.id, actor: { source: "gui" } })
    assert.equal((await store.GetItem({ item: e2.id })).statusKey, "done")
})
