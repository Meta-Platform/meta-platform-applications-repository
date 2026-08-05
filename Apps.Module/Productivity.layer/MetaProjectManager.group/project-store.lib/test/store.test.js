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
    // Assíncrona desde o modelo de entrega: a política depende de QUAL projeto se
    // pergunta (legado pergunta antes de agir, entrega revisa depois).
    const policy = await store.AgentGatePolicy()
    assert.equal(policy.model, "legacy", "sem projeto, responde a política legada")
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

test("MPME-19/20/22 progresso, reivindicação e pulse orquestram agentes em paralelo", async () => {
    const p = await store.CreateProject({ name: "Paralelo", keyPrefix: "PAR", status: "active", actor: { source: "cli" } })
    const a = await store.CreateItem({ project: p.id, type: "task", title: "Tarefa A" })
    const b = await store.CreateItem({ project: p.id, type: "task", title: "Tarefa B" })

    const agente1 = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "par-1" } }
    const agente2 = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "par-2" } }

    // 1. Um agente reivindica; o outro não consegue o mesmo item.
    const claim = await store.ClaimItem({ item: a.id, actor: agente1 })
    assert.ok(claim.claim.expiresAt, "a reivindicação tem validade")
    await assert.rejects(() => store.ClaimItem({ item: a.id, actor: agente2 }), (e) => e.code === "ITEM_CLAIMED")

    // 2. O item reivindicado sai da fila (senão dois pegam o mesmo trabalho).
    const fila = await store.Ready({ project: p.id })
    assert.ok(!fila.some((i) => i.id === a.id), "item com dono não é oferecido")
    assert.ok(fila.some((i) => i.id === b.id), "o resto da fila continua")

    // 3. Reportar progresso registra o relato E renova a reivindicação.
    const progresso = await store.ReportProgress({ item: a.id, note: "lendo o ReportsStore", phase: "investigando", actor: agente1 })
    assert.equal(progresso.kind, "progress")
    assert.ok(progresso.claim, "reportar é o heartbeat da reivindicação")

    // 4. A Execução mostra quem está com o quê e o último reporte.
    const exec = await store.ExecutionOverview({ project: p.id })
    assert.equal(exec.agents.length, 1)
    assert.equal(exec.agents[0].item.key, a.key)
    assert.equal(exec.agents[0].lastProgress.body, "lendo o ReportsStore")

    // 5. O pulse conta o que aconteceu, do mais recente para o mais antigo.
    const pulse = await store.ProjectPulse({ project: p.id, limit: 10 })
    assert.ok(pulse.events.length > 0)
    assert.equal(pulse.events[0].summary, "lendo o ReportsStore", "o mais recente vem primeiro")

    // 6. Liberar devolve o item à fila.
    await store.ReleaseItem({ item: a.id, actor: agente1 })
    const filaDepois = await store.Ready({ project: p.id })
    assert.ok(filaDepois.some((i) => i.id === a.id), "liberado, volta para a fila")
})

test("MPME-21 sequência diz o estado de cada item e de quem ele espera", async () => {
    const p = await store.CreateProject({ name: "Sequencia", keyPrefix: "SEQ", status: "active", actor: { source: "cli" } })
    const base = await store.CreateItem({ project: p.id, type: "task", title: "Base" })
    const depende = await store.CreateItem({ project: p.id, type: "task", title: "Depende da base" })
    const livre = await store.CreateItem({ project: p.id, type: "task", title: "Livre" })
    const travado = await store.CreateItem({ project: p.id, type: "task", title: "Travado" })
    await store.LinkItem({ item: depende.id, relation: "depends", target: base.id })
    await store.SetBlocked({ item: travado.id, reason: "sem credencial" })
    await store.SetStatus({ item: base.id, status: "in-progress" })

    const seq = await store.SequenceView({ project: p.id })
    const byKey = {}
    seq.items.forEach((i) => { byKey[i.key] = i })

    assert.equal(byKey[base.key].state, "doing")
    assert.deepEqual(byKey[base.key].unblocks, [depende.key], "diz o que ele destrava ao sair")
    assert.equal(byKey[depende.key].state, "waiting")
    assert.deepEqual(byKey[depende.key].waitingFor, [base.key], "diz de QUEM espera")
    assert.equal(byKey[livre.key].state, "ready")
    assert.equal(byKey[travado.key].state, "blocked")
    assert.equal(byKey[travado.key].blockedReason, "sem credencial")

    assert.equal(seq.counts.doing, 1)
    assert.equal(seq.counts.waiting, 1)
    assert.equal(seq.counts.ready, 1)
    assert.equal(seq.counts.blocked, 1)

    // Concluir a base solta quem esperava.
    await store.SetStatus({ item: base.id, status: "done" })
    const depois = await store.SequenceView({ project: p.id })
    const dep = depois.items.find((i) => i.key === depende.key)
    assert.equal(dep.state, "ready", "sem dependência aberta, vira pronto")
    assert.deepEqual(dep.waitingFor, [])
})

// ─────────────── MPMX3: coordenação entre agentes ───────────────
//
// O atrito que estes testes travam é o de sessões simultâneas no MESMO
// checkout: pegar o mesmo item, não saber quem chegou/saiu, avisar o outro sem
// que ele leia, e o board mentindo enquanto a aprovação não vem.

test("MPMX3-15/16 quem está aqui, e o aviso de companhia chega na primeira escrita", async () => {
    const p = await store.CreateProject({ name: "Coordenacao", keyPrefix: "COORD", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Alvo" })

    const um = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "coord-1" } }
    const dois = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "coord-2" } }

    await store.ClaimItem({ item: item.id, actor: um })
    await store.ReportProgress({ item: item.id, note: "lendo o PresenceStore", phase: "investigando", actor: um })

    const aqui = await store.WhoIsHere({ project: p.id, actor: dois })
    const outro = aqui.sessions.find((s) => s.model === "claude-opus-5")
    assert.ok(outro, "a sessão vizinha aparece")
    assert.deepEqual(outro.claimedItems.map((i) => i.key), [item.key], "diz COM O QUE ela está")
    assert.equal(outro.lastProgress.note, "lendo o PresenceStore", "e o que ela relatou por último")
    assert.equal(outro.presence, "here")

    // Primeira ESCRITA da segunda sessão: ela é avisada da companhia sem ter perguntado.
    const sessao2 = await store.ResolveOrCreateSessionByIdentity(dois.session, "test")
    await store.WarnAboutCompany({ session: await store.models.AgentSession.findOne({ where: { id: sessao2.id } }) })
    const avisos = await store.CollectNotices({ actor: dois })
    assert.ok(avisos.some((n) => /outra\(s\) sessão\(ões\) ativa\(s\)/.test(n.body)), "o aviso de companhia chega")
    assert.ok(avisos.some((n) => /git add/.test(n.body)), "e diz o que fazer com a informação")

    // Entregue é lido: não se repete indefinidamente.
    const denovo = await store.CollectNotices({ actor: dois })
    assert.ok(!denovo.some((n) => /outra\(s\) sessão\(ões\)/.test(n.body)), "aviso lido não volta")
})

test("MPMX3 entrada e saída de agente viram aviso para quem já está trabalhando", async () => {
    const p = await store.CreateProject({ name: "EntraSai", keyPrefix: "ESAI", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Item da casa" })

    const veterano = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "esai-1" } }
    const novato = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "esai-2" } }

    await store.ClaimItem({ item: item.id, actor: veterano })
    await store.CollectNotices({ actor: veterano })   // zera o que já havia

    // O novato entra em cena (liberação da sessão = entrada).
    const nova = await store.ResolveOrCreateSessionByIdentity(novato.session, "test")
    await store.AnnounceArrival({ session: await store.models.AgentSession.findOne({ where: { id: nova.id } }) })

    const aoEntrar = await store.CollectNotices({ actor: veterano })
    assert.ok(aoEntrar.some((n) => n.kind === "joined" && /gpt-6/.test(n.body)), "quem já trabalhava fica sabendo da entrada")

    // E a saída também avisa — liberando o que a sessão segurava.
    const outroItem = await store.CreateItem({ project: p.id, type: "task", title: "Item do novato" })
    await store.ClaimItem({ item: outroItem.id, actor: novato })
    const fim = await store.EndSession({ note: "terminei a fatia", actor: novato })
    assert.deepEqual(fim.releasedItems, [outroItem.key], "sair devolve os itens à fila na hora")

    const aoSair = await store.CollectNotices({ actor: veterano })
    assert.ok(aoSair.some((n) => n.kind === "left" && /gpt-6/.test(n.body)), "e a saída também é anunciada")
    const claimDepois = await store.GetItemClaim({ item: outroItem.id })
    assert.equal(claimDepois, undefined, "o item do agente que saiu não fica travado")
})

test("MPMX3-19 recado dirigido chega a quem reivindicou o item", async () => {
    const p = await store.CreateProject({ name: "Recado", keyPrefix: "RECAD", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Arquivo disputado" })
    const dono = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "recad-1" } }
    const vizinho = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "recad-2" } }

    await store.ClaimItem({ item: item.id, actor: dono })
    await store.CollectNotices({ actor: dono })

    // Endereçado pelo ITEM: quem manda não precisa descobrir o id da sessão.
    await store.SendSessionMessage({ item: item.key, project: p.id, body: "varri um arquivo teu para o meu commit", actor: vizinho })

    const recebidos = await store.CollectNotices({ actor: dono })
    const recado = recebidos.find((n) => n.kind === "message")
    assert.ok(recado, "o recado chega sem que o alvo tenha consultado nada")
    assert.match(recado.body, /varri um arquivo teu/)
    assert.ok(!(await store.CollectNotices({ actor: dono })).some((n) => n.kind === "message"), "recado lido não se repete")

    // Item sem dono não tem a quem falar.
    const orfao = await store.CreateItem({ project: p.id, type: "task", title: "Sem dono" })
    await assert.rejects(() => store.SendSessionMessage({ item: orfao.id, body: "oi", actor: vizinho }), (e) => e.code === "NOT_FOUND")
})

test("MPMX3-22/next_task fila limpa: item tomado sai, e pegar tarefa já reivindica", async () => {
    const p = await store.CreateProject({ name: "FilaLimpa", keyPrefix: "FILA", status: "active", actor: { source: "cli" } })
    const a = await store.CreateItem({ project: p.id, type: "task", title: "Primeira" })
    const b = await store.CreateItem({ project: p.id, type: "task", title: "Segunda" })
    const um = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "fila-1" } }
    const dois = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "fila-2" } }

    // Pegar tarefa é uma chamada só: escolhe e reivindica.
    const pego = await store.NextTask({ project: p.id, actor: um })
    assert.ok(pego.item, "veio uma tarefa")
    assert.ok(pego.claim.expiresAt, "e ela já está reivindicada")

    // O segundo agente não vê o item tomado na fila, e pega outro.
    const fila = await store.ListItems({ project: p.id, actor: dois })
    assert.ok(!fila.some((i) => i.id === pego.item.id), "item com dono sai da fila dos outros")
    const outro = await store.NextTask({ project: p.id, actor: dois })
    assert.notEqual(outro.item.id, pego.item.id, "dois agentes nunca pegam o mesmo item")

    // Quem quer o quadro completo pede — e enxerga a reivindicação.
    const tudo = await store.ListItems({ project: p.id, includeClaimed: true, actor: dois })
    const tomado = tudo.find((i) => i.id === pego.item.id)
    assert.ok(tomado, "includeClaimed mostra tudo")
    assert.ok(tomado.claim && tomado.claim.sessionId, "e a reivindicação aparece no resumo")

    // A minha própria reivindicação continua visível para mim.
    const minhaFila = await store.ListItems({ project: p.id, actor: um })
    assert.ok(minhaFila.some((i) => i.id === pego.item.id), "vejo o que eu mesmo peguei")

    // Fila esgotada responde POR QUÊ, em vez de devolver vazio sem explicação.
    const seca = await store.NextTask({ project: p.id, actor: um })
    assert.equal(seca.item, undefined)
    assert.match(seca.message, /reivindicad|vazia/)
    assert.ok([a.id, b.id].includes(pego.item.id))
})

test("MPMX3-24 status pedido e não aprovado fica visível no item", async () => {
    const p = await store.CreateProject({ name: "Pendente", keyPrefix: "PEND", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Em curso" })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "pend-1" } }

    await assert.rejects(
        () => store.SetStatus({ item: item.id, status: "in-progress", actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED"
    )
    const depois = await store.GetItem({ item: item.id })
    assert.equal(depois.statusKey, "backlog", "o status real só muda com a aprovação")
    assert.equal(depois.pendingStatusKey, "in-progress", "mas o quadro para de mentir: há trabalho pedido aqui")

    // Aprovado, o pendente some (o status real assume).
    const pedidos = await store.ListCreationRequests({ status: "pending", projectId: p.id })
    const pedido = pedidos.find((r) => r.actionName === "set-status")
    await store.ApproveRequest({ request: pedido.id, actor: { source: "cli", actorUserId: null } })
    const aprovado = await store.GetItem({ item: item.id })
    assert.equal(aprovado.statusKey, "in-progress")
    assert.equal(aprovado.pendingStatusKey, null, "aprovado, não há mais nada pendente")
})

test("MPMX3-17/21 foco da sessão é editável e ambiente compartilhado fica registrado", async () => {
    const p = await store.CreateProject({ name: "Ambiente", keyPrefix: "AMBI", status: "active", actor: { source: "cli" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "ambi-1" } }

    const sessao = await store.ResolveOrCreateSessionByIdentity(agente.session, "test")
    await store.ConfirmSession({ session: sessao.id, actor: { source: "cli" } })

    // Identidade não muda depois de liberada; intenção muda.
    await assert.rejects(
        () => store.DeclareSession({ provider: "codex", actor: agente }),
        (e) => e.code === "VALIDATION_ERROR"
    )
    const atualizada = await store.DeclareSession({ objective: "resolver os feedbacks", actor: agente })
    assert.equal(atualizada.objective, "resolver os feedbacks", "redeclarar só o objetivo é aceito")

    // Reportar progresso mantém o foco atual em dia, sem chamada extra.
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Trabalho" })
    await store.ReportProgress({ item: item.id, note: "subindo o orquestrador", actor: agente })
    const comFoco = await store.GetSession({ session: sessao.id })
    assert.equal(comFoco.currentFocus, "subindo o orquestrador")

    // Ação sobre ambiente compartilhado: histórico consultável POR TIPO + aviso.
    // O vizinho precisa já estar em cena: broadcast alcança quem está presente
    // quando ele acontece, não quem chega depois (ninguém recebe histórico).
    const vizinho = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "ambi-2" } }
    await store.ResolveOrCreateSessionByIdentity(vizinho.session, "test")
    await store.RecordEnvironmentAction({ project: p.id, action: "up", target: "service-orchestrator", note: "não derrube", actor: agente })
    const registros = await store.ListEnvironmentActions({ project: p.id, actor: { source: "cli" } })
    assert.equal(registros.length, 1)
    assert.match(registros[0].body, /\[up\] service-orchestrator/)
    const notas = await store.ListActivityNotes({ project: p.id, actor: { source: "cli" } })
    assert.ok(notas.length > registros.length, "o filtro por tipo separa ambiente do resto")

    const avisos = await store.CollectNotices({ actor: vizinho })
    assert.ok(avisos.some((n) => n.kind === "environment" && /service-orchestrator/.test(n.body)), "quem depende do processo é avisado")
})

test("MPMX3 presença envelhece: sessão sem sinal sai sozinha e avisa", async () => {
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "sweep-1" } }
    const testemunha = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "sweep-2" } }
    const sessao = await store.ResolveOrCreateSessionByIdentity(agente.session, "test")
    await store.ResolveOrCreateSessionByIdentity(testemunha.session, "test")
    await store.CollectNotices({ actor: testemunha })

    // Empurra a última atividade para trás do limite de "sumiu".
    await store.models.AgentSession.update(
        { lastActivityAt: new Date(Date.now() - 90 * 60000), presence: "here" },
        { where: { id: sessao.id } }
    )
    const mudou = await store.SweepPresence()
    assert.ok(mudou.some((m) => m.sessionId === sessao.id && m.presence === "gone"), "sessão sem sinal deixa de constar presente")

    const avisos = await store.CollectNotices({ actor: testemunha })
    assert.ok(avisos.some((n) => n.kind === "left" && /sem sinal/.test(n.body)), "a saída por silêncio também é anunciada")

    // Voltar a agir traz a sessão de volta — e anuncia o retorno.
    await store.TouchSession({ actor: agente, action: "test" })
    const viva = await store.GetSession({ session: sessao.id })
    assert.equal(viva.presence, "here")
})

// ─────────────── MPMX3: gate, fila e leituras (itens 8 a 14 e 23) ───────────────

test("MPMX3-14 update_item com status passa pelo MESMO gate de set_item_status", async () => {
    const p = await store.CreateProject({ name: "GateStatus", keyPrefix: "GST", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Alvo do gate" })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "gst-1" } }

    // O caminho lateral estava aberto: update_item escrevia o status direto.
    await assert.rejects(
        () => store.UpdateItem({ item: item.id, statusKey: "done", actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED"
    )
    assert.equal((await store.GetItem({ item: item.id })).statusKey, "backlog")

    // Transição livre continua livre por qualquer caminho.
    const livre = await store.UpdateItem({ item: item.id, statusKey: "review", actor: agente })
    assert.equal(livre.statusKey, "review")

    // E o patch misto (status + outro campo) não perde o resto.
    const misto = await store.UpdateItem({ item: item.id, statusKey: "ready", title: "Renomeado", actor: agente })
    assert.equal(misto.title, "Renomeado")
    assert.equal((await store.GetItem({ item: item.id })).statusKey, "ready")
})

test("MPMX3-9 aprovação tardia não reverte item que já mudou de estado", async () => {
    const p = await store.CreateProject({ name: "Tardia", keyPrefix: "TARD", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Vai avançar sozinho" })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "tard-1" } }

    await assert.rejects(() => store.SetStatus({ item: item.id, status: "in-progress", actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pedido = (await store.ListCreationRequests({ status: "pending", projectId: p.id }))
        .find((r) => r.actionName === "set-status" && r.targetId === item.id)

    // O agente desistiu de esperar e o item seguiu por outro caminho.
    await store.SetStatus({ item: item.id, status: "review", actor: { source: "cli" } })

    // Horas depois, o humano encontra o pedido antigo e aprova.
    await assert.rejects(() => store.ApproveRequest({ request: pedido.id, actor: { source: "gui" } }),
        (e) => e.code === "STALE_APPROVAL")
    assert.equal((await store.GetItem({ item: item.id })).statusKey, "review", "o estado atual é preservado")

    // E o pedido sai da fila, preservado como expirado (não fica pendente para sempre).
    const aindaPendente = (await store.ListCreationRequests({ status: "pending", projectId: p.id }))
        .some((r) => r.id === pedido.id)
    assert.equal(aindaPendente, false)
})

test("MPMX3-8 um pedido move vários itens, e o humano decide em bloco", async () => {
    const p = await store.CreateProject({ name: "Lote", keyPrefix: "LOTE", status: "active", actor: { source: "cli" } })
    const a = await store.CreateItem({ project: p.id, type: "task", title: "Um" })
    const b = await store.CreateItem({ project: p.id, type: "task", title: "Dois" })
    const c = await store.CreateItem({ project: p.id, type: "task", title: "Três" })
    await store.AddAcceptanceCriteria({ item: a.id, text: "critério em aberto" })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "lote-1" } }

    // Transição LIVRE não abre pedido nenhum.
    const livre = await store.SetStatusBatch({ items: [a.key, b.key, c.key], status: "review", actor: agente })
    assert.equal(livre.total, 3)

    // Concluir os três: UM pedido para o conjunto.
    await assert.rejects(() => store.SetStatusBatch({ items: [a.key, b.key, c.key], status: "done", actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
    const pendentes = await store.ListCreationRequests({ status: "pending", projectId: p.id })
    assert.equal(pendentes.length, 1, "um pedido, não três")
    const pedido = pendentes[0]
    assert.equal(pedido.subject.batch.length, 3, "o pedido carrega a lista inteira")
    assert.equal(pedido.subject.unmetCriteria.length, 1, "e os critérios em aberto do conjunto")

    await store.ApproveRequest({ request: pedido.id, actor: { source: "gui" } })
    for(const item of [a, b, c])
        assert.equal((await store.GetItem({ item: item.id })).statusKey, "done")
})

test("MPMX3-8 decisão em lote de pedidos independentes", async () => {
    const p = await store.CreateProject({ name: "LoteDecide", keyPrefix: "LDEC", status: "active", actor: { source: "cli" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "ldec-1" } }
    const criados = []
    for(const titulo of ["A", "B"]){
        const item = await store.CreateItem({ project: p.id, type: "task", title: titulo })
        await assert.rejects(() => store.SetStatus({ item: item.id, status: "in-progress", actor: agente }),
            (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
        criados.push(item)
    }
    const ids = (await store.ListCreationRequests({ status: "pending", projectId: p.id })).map((r) => r.id)
    assert.equal(ids.length, 2)

    const out = await store.DecideRequests({ requests: ids, decision: "approve", actor: { source: "gui" } })
    assert.equal(out.succeeded, 2)
    for(const item of criados)
        assert.equal((await store.GetItem({ item: item.id })).statusKey, "in-progress")
})

test("MPMX3-10 concluir devolve os critérios de aceite não atendidos", async () => {
    const p = await store.CreateProject({ name: "Criterios", keyPrefix: "CRIT", status: "active", actor: { source: "cli" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Com definição de pronto" })
    const um = await store.AddAcceptanceCriteria({ item: item.id, text: "servidor também limita a taxa" })
    const dois = await store.AddAcceptanceCriteria({ item: item.id, text: "navegação por data" })

    const fechado = await store.SetStatus({ item: item.id, status: "done", actor: { source: "cli" } })
    assert.equal(fechado.unmetAcceptanceCriteria.length, 2, "fechar não silencia o que falta")
    assert.match(fechado.unmetAcceptanceCriteria[0].text, /limita a taxa/)

    // MPMX3-11: marcar os dois numa chamada só.
    const marcados = await store.UpdateAcceptanceCriteria({ criteria: [um.id, dois.id], met: true })
    assert.equal(marcados.length, 2)
    assert.ok(marcados.every((c) => c.met))
    const limpo = await store.SetStatus({ item: item.id, status: "review", actor: { source: "cli" } })
    assert.equal(limpo.unmetAcceptanceCriteria, undefined)

    // E com valores diferentes por critério.
    const mistos = await store.UpdateAcceptanceCriteria({ updates: [{ criteria: um.id, met: false }, { criteria: dois.id, met: true }] })
    assert.equal(mistos[0].met, false)
    assert.equal(mistos[1].met, true)
    assert.equal((await store.UnmetAcceptanceCriteria({ item: item.id })).length, 1)
})

test("MPMX3-12 list_items encontra a entrega pelo NOME, não só pelo id", async () => {
    const p = await store.CreateProject({ name: "PorNome", keyPrefix: "PNOM", status: "active", actor: { source: "cli" } })
    const entrega = await store.CreateMilestone({ project: p.id, name: "M1 — Fundação" })
    const sprint = await store.CreateSprint({ project: p.id, name: "Sprint 1" })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Na entrega", milestoneId: entrega.id, sprintId: sprint.id })

    const porNome = await store.ListItems({ project: p.id, milestone: "M1 — Fundação" })
    assert.equal(porNome.length, 1, "o nome resolve — antes devolvia zero, em silêncio")
    assert.equal(porNome[0].id, item.id)
    assert.equal((await store.ListItems({ project: p.id, sprint: "Sprint 1" })).length, 1)
    assert.equal((await store.ListItems({ project: p.id, milestone: entrega.id })).length, 1, "o id continua valendo")

    // Referência inexistente RECUSA, em vez de devolver lista vazia.
    await assert.rejects(() => store.ListItems({ project: p.id, milestone: "Entrega que não existe" }),
        (e) => e.code === "NOT_FOUND")
})

test("MPMX3-13 ideias do inbox mudam de casa em vez de sumir com o projeto", async () => {
    const p = await store.CreateProject({ name: "Encerrar", keyPrefix: "ENCE", status: "active", actor: { source: "cli" } })
    const futuro = await store.CreateProject({ name: "Ideias Futuras", keyPrefix: "FUT", status: "active", actor: { source: "cli" } })
    const ideia = await store.CreateItem({ project: p.id, type: "improvement", title: "Export para OpenTelemetry", horizon: "inbox" })

    const movida = await store.MoveItemToProject({ item: ideia.id, project: futuro.id, actor: { source: "cli" } })
    assert.equal(movida.projectId, futuro.id)
    assert.ok(movida.key.startsWith("FUT-"), "a key é do projeto novo — ela pertence ao projeto")
    assert.equal((await store.ListItems({ project: p.id, horizon: "inbox" })).length, 0)
    assert.equal((await store.ListItems({ project: futuro.id, horizon: "inbox" })).length, 1)
})

test("MPMX3-23 get_activity_context vem enxuto por padrão", async () => {
    const p = await store.CreateProject({ name: "Contexto", keyPrefix: "CTX", status: "active", actor: { source: "cli" } })
    const longo = "x".repeat(3000)
    await store.AddActivityNote({ project: p.id, text: `Nota longa: ${longo}`, actor: { source: "cli" } })

    const enxuto = await store.GetActivityContext({ project: p.id, actor: { source: "cli" } })
    assert.ok(enxuto.notes[0].truncated, "o corpo é recortado")
    assert.ok(enxuto.notes[0].body.length < 500)
    assert.ok(enxuto.notes[0].bodyChars > 3000, "mas diz o tamanho real")
    assert.ok(enxuto._trimmed, "e avisa que recortou")
    assert.ok(enxuto.audit.every((e) => e.before === undefined && e.after === undefined), "auditoria sem os diffs")

    const inteiro = await store.GetActivityContext({ project: p.id, fullText: true, actor: { source: "cli" } })
    assert.ok(inteiro.notes[0].body.length > 3000, "fullText traz tudo para quem precisa")
    assert.equal(inteiro._trimmed, undefined)
})

test("MPMX3 varredura não anuncia a saída de sessão antiga (só marca gone)", async () => {
    const antiga = { source: "agent", session: { provider: "codex", modelName: "gpt-6", traceId: "velha-1" } }
    const testemunha = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "velha-2" } }
    const s = await store.ResolveOrCreateSessionByIdentity(antiga.session, "test")
    await store.ResolveOrCreateSessionByIdentity(testemunha.session, "test")
    await store.CollectNotices({ actor: testemunha })

    // Parada há dias: virar `gone` é a verdade, mas não é notícia para ninguém.
    await store.models.AgentSession.update(
        { lastActivityAt: new Date(Date.now() - 72 * 3600 * 1000), presence: "here" },
        { where: { id: s.id } }
    )
    await store.SweepPresence()
    assert.equal((await store.GetSession({ session: s.id })).presence, "gone")
    const avisos = await store.CollectNotices({ actor: testemunha })
    assert.ok(!avisos.some((n) => n.kind === "left" && /gpt-6/.test(n.body)),
        "sessão morta há dias não vira aviso — senão a primeira varredura afoga o canal")
})

// ── MODELO DE ENTREGA (MPMR) ────────────────────────────────────────────────

test("MPMR-5 as sete tabelas do modelo de entrega nascem do sync()", async () => {
    const [rows] = await store.sequelize.query("SELECT name FROM sqlite_master WHERE type='table'")
    const tabelas = rows.map((r) => r.name)
    for(const t of ["deliveries", "delivery_evidence", "delivery_reviews",
                    "agent_mandates", "agent_role_assignments", "agent_plans", "agent_plan_nodes"]){
        assert.ok(tabelas.includes(t), `tabela ${t} não foi criada`)
    }
})

test("MPMR-6 banco PRÉ-EXISTENTE ganha as colunas novas sem quebrar o boot", async () => {
    // O caso real: um banco criado antes desta mudança. Se uma coluna indexada
    // faltar do ADDED_COLUMNS, o sync() tenta criar o índice antes da coluna e o
    // boot quebra com "no such column" — em produção, não só aqui.
    const antigo = path.join(TMP, "pre-existente.sqlite")
    const velho = InitializeProjectStore({ storage: antigo, attachmentsDirPath: ATT_DIR })
    await velho.ConnectAndSync()
    const proj = await velho.CreateProject({ name: "Antes da refundação", keyPrefix: "OLD", status: "active", actor: { source: "cli" } })
    await velho.CreateItem({ project: proj.id, type: "task", title: "Item antigo", actor: { source: "cli" } })
    // Simula o banco de ANTES: derruba as colunas novas e o que o sync() criou.
    // Os índices saem primeiro — num banco realmente antigo eles nunca existiram,
    // e o SQLite recusa derrubar a coluna enquanto um índice apontar para ela.
    for(const idx of ["work_items_execution_state", "work_items_review_state"]){
        await velho.sequelize.query(`DROP INDEX IF EXISTS \`${idx}\``)
    }
    for(const c of ["deliveryModel", "deliveryModelAt", "deliveryModelByUserId", "verifyCommand",
                    "verifyCwd", "requireKeyInCommit", "requireAiReview", "aiReviewTimeoutMinutes"]){
        await velho.sequelize.query(`ALTER TABLE projects DROP COLUMN \`${c}\``)
    }
    for(const c of ["executionState", "reviewState", "currentDeliveryId", "deliveryCount",
                    "returnCount", "mandateId", "verifyCommand", "planNodeId", "lastReviewedAt"]){
        await velho.sequelize.query(`ALTER TABLE work_items DROP COLUMN \`${c}\``)
    }
    for(const t of ["deliveries", "delivery_evidence", "delivery_reviews", "agent_mandates",
                    "agent_role_assignments", "agent_plans", "agent_plan_nodes"]){
        await velho.sequelize.query(`DROP TABLE IF EXISTS \`${t}\``)
    }
    await velho.sequelize.close()

    // Agora o boot precisa migrar sozinho — é isto que roda na máquina do usuário.
    const migrado = InitializeProjectStore({ storage: antigo, attachmentsDirPath: ATT_DIR })
    await migrado.ConnectAndSync()

    const [[p]] = await migrado.sequelize.query("SELECT deliveryModel, requireAiReview, aiReviewTimeoutMinutes FROM projects LIMIT 1")
    assert.equal(p.deliveryModel, 0, "projeto que já existia continua no modelo legado")
    assert.equal(p.requireAiReview, 1)
    assert.equal(p.aiReviewTimeoutMinutes, 30)

    const [[i]] = await migrado.sequelize.query("SELECT executionState, reviewState, deliveryCount, returnCount FROM work_items LIMIT 1")
    assert.equal(i.executionState, "queued", "item que já existia entra na fila do modelo novo")
    assert.equal(i.reviewState, "none")
    assert.equal(i.deliveryCount, 0)
    assert.equal(i.returnCount, 0)

    const [rows] = await migrado.sequelize.query("SELECT name FROM sqlite_master WHERE type='table'")
    assert.ok(rows.map((r) => r.name).includes("deliveries"), "as tabelas novas voltam no boot seguinte")

    // E o dado antigo continua legível — o ALTER não pode custar o histórico.
    const itens = await migrado.ListItems({ project: proj.id })
    assert.equal(itens.length, 1)
    assert.equal(itens[0].title, "Item antigo")
    await migrado.sequelize.close()
})

// O revisor humano dos testes do modelo de entrega precisa existir de verdade:
// aceitar um plano cria itens em nome dele.
let _humanoId
const humano = async () => (_humanoId ||= (await store.CreateUser({ type: "human", displayName: "Revisor Humano" })).id)

test("MPMR ciclo completo: entregar, revisor devolve, reentregar, humano aceita", async () => {
    const p = await store.CreateProject({ name: "Refundado", keyPrefix: "REF", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui", actorUserId: await humano() } })

    const item = await store.CreateItem({ project: p.id, type: "task", title: "Trocar o motor", actor: { source: "cli" } })
    await store.AddAcceptanceCriteria({ item: item.id, text: "o motor liga" })

    const executor = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "exec-1" } }
    const revisor  = { source: "agent", session: { provider: "codex",  modelName: "gpt-6",         traceId: "rev-1"  } }

    // Pegar trabalho tira o item da fila e o põe em execução — sem pedir nada.
    const pego = await store.NextTask({ project: p.id, actor: executor })
    assert.equal(pego.item.key, item.key)
    assert.ok(/Cite REF-1/.test(pego.commitConvention), "a convenção de commit volta em todo ciclo")
    assert.equal((await store.GetItem({ item: item.id })).executionState, "claimed")

    // Entregar: sem gate, sem modal, sem aprovação.
    const entrega = await store.SubmitDelivery({ item: item.id, summary: "Motor trocado e testado.", actor: executor })
    assert.equal(entrega.key, "REF-1/D1")
    assert.equal(entrega.status, "ai-review", "vai para o revisor-IA antes do humano")
    assert.equal((await store.GetItem({ item: item.id })).statusKey, "review", "o board acompanha")

    // Quem executou não revisa.
    await assert.rejects(
        () => store.SubmitReview({ delivery: entrega.id, decision: "pass", actor: executor }),
        (e) => e.code === "SAME_SESSION_REVIEW")

    // O revisor devolve — e devolver exige motivo.
    await store.DeclareRole({ role: "reviewer", actor: revisor })
    await assert.rejects(
        () => store.SubmitReview({ delivery: entrega.id, decision: "return", actor: revisor }),
        (e) => e.code === "VALIDATION_ERROR")
    await store.SubmitReview({ delivery: entrega.id, decision: "return", reason: "Faltou testar a partida a frio.", actor: revisor })

    const devolvido = await store.GetItem({ item: item.id })
    assert.equal(devolvido.reviewState, "returned")
    assert.equal(devolvido.returnCount, 1)
    assert.equal(devolvido.claimedBySessionId, (await store.FindSessionByIdentity(executor.session)).id,
        "volta para quem fez, não para a fila")
    assert.ok((await store.Ready({ project: p.id })).every((i) => i.key !== item.key),
        "item devolvido tem dono: não é oferecido a outro agente")

    // A crítica chega como instrução, não como registro esquecido.
    const comentarios = await store.ListComments({ item: item.id })
    assert.ok(comentarios.some((c) => /partida a frio/.test(c.body)), "a crítica vira comentário no item")

    // Reentrega: rodada 2.
    const entrega2 = await store.SubmitDelivery({ item: item.id, summary: "Agora com partida a frio.", actor: executor })
    assert.equal(entrega2.round, 2)
    assert.equal(entrega2.key, "REF-1/D2")

    // Revisor passa; sobe ao humano com o parecer, sem concluir nada.
    await store.SubmitReview({ delivery: entrega2.id, decision: "pass", reason: "Critério coberto.", actor: revisor })
    const esperando = await store.GetDelivery({ delivery: entrega2.id })
    assert.equal(esperando.status, "awaiting-human")
    assert.equal(esperando.aiReviewState, "passed")
    assert.notEqual((await store.GetItem({ item: item.id })).statusKey, "done", "a IA não conclui sozinha")

    // A Mesa mostra exatamente o que espera pelo humano.
    const mesa = await store.ReviewDesk({ project: p.id })
    assert.equal(mesa.counts.deliveries, 1)
    assert.equal(mesa.deliveries[0].key, "REF-1/D2")
    assert.equal(mesa.deliveries[0].aiOpinion.verdict, "pass")

    // O humano aceita: é isto que conclui o item.
    const revisorHumano = await humano()
    await store.AcceptDelivery({ delivery: entrega2.id, actor: { source: "gui", actorUserId: revisorHumano } })
    const concluido = await store.GetItem({ item: item.id })
    assert.equal(concluido.statusKey, "done")
    assert.equal(concluido.executionState, "done")
    assert.equal(concluido.reviewState, "accepted")
    assert.equal(concluido.claimedBySessionId, null, "item aceito não tem mais dono")

    // A decisão humana entra na MESMA trilha do parecer de IA. Sem isto o
    // histórico de revisão mentiria por omissão: só apareceria quem opinou,
    // nunca quem decidiu.
    const revisoes = await store.models.DeliveryReview.findAll({ where: { workItemId: item.id }, order: [["createdAt", "ASC"]] })
    const humanas = revisoes.filter((r) => r.reviewerType === "human")
    assert.equal(humanas.length, 1, "o aceite humano fica registrado como revisão")
    assert.equal(humanas[0].decision, "accept")
    assert.equal(humanas[0].reviewerUserId, revisorHumano)
    assert.equal(humanas[0].deliveryId, entrega2.id, "registrada na rodada que foi decidida")
})

test("MPMR devolver pela mesa registra a revisão humana com o motivo", async () => {
    const executor = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "dev-humana" } }
    const p = await store.CreateProject({ name: "Devolução humana", keyPrefix: "DVH", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "cli" } })
    await store.UpdateProject({ project: p.id, requireAiReview: false, actor: { source: "cli" } })

    const item = await store.CreateItem({ project: p.id, type: "task", title: "Ajustar o cabeçalho", actor: { source: "cli" } })
    await store.ClaimItem({ item: item.id, actor: executor })
    const entrega = await store.SubmitDelivery({ item: item.id, summary: "Cabeçalho ajustado.", actor: executor })

    const quem = await humano()
    await store.ReturnDelivery({
        delivery: entrega.id, reason: "A margem continua errada no modo escuro.",
        reviewerType: "human", actor: { source: "gui", actorUserId: quem }
    })

    const revisoes = await store.models.DeliveryReview.findAll({ where: { deliveryId: entrega.id } })
    assert.equal(revisoes.length, 1)
    assert.equal(revisoes[0].reviewerType, "human")
    assert.equal(revisoes[0].decision, "return")
    assert.equal(revisoes[0].reason, "A margem continua errada no modo escuro.")
    assert.equal(revisoes[0].reviewerUserId, quem)
    assert.equal(revisoes[0].round, 1)
})

test("MPMR projeto migrado conclui sem aprovação; projeto legado continua pedindo", async () => {
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "gate-1" } }

    // LEGADO: o gate de sempre.
    const legado = await store.CreateProject({ name: "Ainda legado", keyPrefix: "LEG", status: "active", actor: { source: "cli" } })
    const i1 = await store.CreateItem({ project: legado.id, type: "task", title: "Tarefa antiga", actor: { source: "cli" } })
    await assert.rejects(
        () => store.SetStatus({ item: i1.id, status: "done", actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED",
        "projeto legado continua exigindo aprovação para concluir")

    // MIGRADO: a mesma transição passa direto — quem decide é a revisão, depois.
    const novo = await store.CreateProject({ name: "Já migrado", keyPrefix: "NOV", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: novo.id, actor: { source: "gui" } })
    const i2 = await store.CreateItem({ project: novo.id, type: "task", title: "Tarefa nova", actor: { source: "cli" } })
    const movido = await store.SetStatus({ item: i2.id, status: "review", actor: agente })
    assert.equal(movido.statusKey, "review")

    // Excluir continua sendo humano nos DOIS modelos: é o que não tem "depois".
    await assert.rejects(
        () => store.DeleteItem({ item: i2.id, actor: agente }),
        (e) => e.code === "AGENT_SESSION_CONFIRMATION_REQUIRED")
})

test("MPMR migração preserva o trabalho em curso e mata pedido pendente órfão", async () => {
    const p = await store.CreateProject({ name: "Em pleno voo", keyPrefix: "VOO", status: "active", actor: { source: "cli" } })
    const emCurso  = await store.CreateItem({ project: p.id, type: "task", title: "Já começada", actor: { source: "cli" } })
    const emReview = await store.CreateItem({ project: p.id, type: "task", title: "Aguardando validação", actor: { source: "cli" } })
    const feita    = await store.CreateItem({ project: p.id, type: "task", title: "Já concluída", actor: { source: "cli" } })
    await store.SetStatus({ item: emCurso.id, status: "in-progress", actor: { source: "cli" } })
    await store.SetStatus({ item: emReview.id, status: "review", actor: { source: "cli" } })
    await store.SetStatus({ item: feita.id, status: "done", actor: { source: "cli" } })

    // Um agente pede para concluir algo: fica pendente na fila do humano.
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "mig-1" } }
    const item4 = await store.CreateItem({ project: p.id, type: "task", title: "Pedido pendente", actor: { source: "cli" } })
    await store.SetStatus({ item: item4.id, status: "done", actor: agente }).catch(() => undefined)
    assert.ok((await store.GetItem({ item: item4.id })).pendingStatusKey, "o pedido marcou o item")

    const r = await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    assert.equal(r.migrated.items, 4)
    assert.equal(r.migrated.retroactiveDeliveries, 1, "o item em validação vira entrega retroativa")
    assert.equal(r.migrated.expiredRequests, 1)

    // O pedido órfão não pode continuar mentindo no board.
    const depois = await store.GetItem({ item: item4.id })
    assert.equal(depois.pendingStatusKey, null)

    assert.equal((await store.GetItem({ item: emCurso.id })).executionState, "executing")
    assert.equal((await store.GetItem({ item: feita.id })).reviewState, "accepted")

    // E a entrega retroativa diz que não tem evidência, em vez de fingir que tem.
    const retro = (await store.ListDeliveries({ item: emReview.id }))[0]
    assert.equal(retro.evidenceQuality, "none")
    assert.equal(retro.status, "awaiting-human")
})

test("MPMR mandato para a linha quando o humano vira o gargalo", async () => {
    const p = await store.CreateProject({ name: "Com mandato", keyPrefix: "MAN", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "man-1" } }
    const sessao = await store.ResolveOrCreateSessionByIdentity(agente.session, "test")

    const itens = []
    for(let n = 1; n <= 4; n++)
        itens.push(await store.CreateItem({ project: p.id, type: "task", title: `Tarefa ${n}`, actor: { source: "cli" } }))

    // O humano concede o mandato: 2 entregas sem revisão e a linha para.
    const mandato = await store.CreateMandate({
        project: p.id, title: "Rodada 1", session: sessao.id,
        maxUnreviewedDeliveries: 2, actor: { source: "gui", actorUserId: await humano() }
    })
    assert.equal(mandato.status, "active")

    for(const item of itens.slice(0, 2)){
        await store.ClaimItem({ item: item.id, actor: agente })
        await store.SubmitDelivery({ item: item.id, summary: "feito", actor: agente })
    }

    const parado = await store.GetMandate({ mandate: mandato.id })
    assert.equal(parado.status, "exhausted")
    assert.equal(parado.stopReason, "unreviewed-limit")

    // O agente é barrado e recebe o que fazer em seguida — não fica tentando.
    await assert.rejects(
        () => store.ClaimItem({ item: itens[2].id, actor: agente }),
        (e) => e.code === "MANDATE_EXHAUSTED" && Array.isArray(e.details.whatNow) && e.details.whatNow.length > 0)

    // O humano revisa uma: a linha volta a andar sozinha. (Ele pode decidir sem
    // esperar o revisor-IA — é a autoridade final, não o último da fila.)
    const pendentes = await store.ListDeliveries({ project: p.id })
    assert.equal(pendentes.length, 2)
    await store.AcceptDelivery({ delivery: pendentes[0].id, actor: { source: "gui", actorUserId: await humano() } })
    assert.equal((await store.GetMandate({ mandate: mandato.id })).status, "active",
        "aceitar destrava o mandato que parou por excesso de entregas sem revisão")
})

test("MPMR entrega sem revisor sobe ao humano marcada como não revisada", async () => {
    const p = await store.CreateProject({ name: "Sem revisor", keyPrefix: "SRV", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    await store.UpdateProject({ project: p.id, aiReviewTimeoutMinutes: 30, actor: { source: "gui" } }).catch(() => undefined)

    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "srv-1" } }
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Ninguém revisa", actor: { source: "cli" } })
    const entrega = await store.SubmitDelivery({ item: item.id, summary: "feito", actor: agente })
    assert.equal(entrega.status, "ai-review")

    // Passa do prazo sem revisor nenhum aparecer.
    await store.models.Delivery.update(
        { submittedAt: new Date(Date.now() - 90 * 60000) }, { where: { id: entrega.id } })
    const varrido = await store.SweepStaleAiReviews({ project: p.id })
    assert.equal(varrido.escalated, 1)

    const subiu = await store.GetDelivery({ delivery: entrega.id })
    assert.equal(subiu.status, "awaiting-human")
    assert.equal(subiu.aiVerdict, "unreviewed", "chega ao humano dizendo que ninguém revisou")
    const mesa = await store.ReviewDesk({ project: p.id })
    assert.equal(mesa.deliveries[0].aiOpinion.verdict, "unreviewed")
})

test("MPMR plano proposto vira backlog, rodada e mandato numa decisão só", async () => {
    // keyPrefix próprio: WorkItem.key é único no BANCO todo, não por projeto —
    // reusar o prefixo de outro teste faz PLA-1 colidir com PLA-1.
    const p = await store.CreateProject({ name: "Planejado", keyPrefix: "PLNO", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "pln-1" } }

    const plano = await store.ProposePlan({
        project: p.id, title: "Reescrever o importador",
        rationale: "O atual não lê o formato novo.", risks: "Pode quebrar a carga noturna.",
        nodes: [
            { ref: "epico", type: "epic", title: "Importador v2" },
            { ref: "parser", parentRef: "epico", type: "feature", title: "Ler o formato novo",
              acceptanceCriteria: ["lê os 3 arquivos de exemplo"], effort: "m" },
            { parentRef: "epico", type: "task", title: "Migrar a carga noturna", dependsOn: ["parser"] }
        ],
        actor: agente
    })
    assert.equal(plano.status, "submitted")
    assert.equal(plano.nodeCount, 3)
    // Enquanto é plano, não existe item nenhum: nada foi despejado no backlog.
    assert.equal((await store.ListItems({ project: p.id })).length, 0)

    // E ele PRECISA aparecer na Mesa. A tela do plano e a rota existiam desde o
    // início, mas nada na navegação levava até lá: um plano proposto ficava
    // esperando um humano que não tinha como saber da existência dele.
    const mesaComPlano = await store.ReviewDesk({ project: p.id })
    assert.equal(mesaComPlano.counts.plans, 1, "plano submetido é decisão pendente")
    assert.equal(mesaComPlano.plans[0].id, plano.id)
    assert.equal(mesaComPlano.plans[0].title, "Reescrever o importador")

    // O humano edita antes de aceitar — e a edição fica marcada.
    const noParser = plano.nodes.find((n) => n.title === "Ler o formato novo")
    await store.RevisePlan({ plan: plano.id, node: noParser.id, updates: { effort: "l" }, actor: { source: "gui" } })

    const aceito = await store.AcceptPlan({ plan: plano.id, actor: { source: "gui", actorUserId: await humano() } })
    assert.equal(aceito.createdItems, 3)
    assert.ok(aceito.sprintId, "a rodada nasce junto")
    assert.ok(aceito.mandateId, "e o mandato que autoriza o agente a executá-la")

    const itens = await store.ListItems({ project: p.id })
    assert.equal(itens.length, 3)
    const parser = itens.find((i) => i.title === "Ler o formato novo")
    assert.equal(parser.effort, "l", "a edição do humano é o que virou item")
    const nos = (await store.GetPlan({ plan: plano.id })).nodes
    assert.ok(nos.find((n) => n.title === "Ler o formato novo").editedByHuman)

    // A dependência declarada no plano existe como vínculo real.
    const migrar = await store.GetItem({ item: itens.find((i) => i.title === "Migrar a carga noturna").id })
    assert.ok(migrar.links.some((l) => l.relation === "depends"), "a dependência do plano virou vínculo")

    // Aceitar o plano é uma decisão só: não pode ser aceito de novo.
    assert.equal((await store.AcceptPlan({ plan: plano.id, actor: { source: "gui" } })).status, "accepted")

    // Decidido, sai da Mesa: ela mostra o que ESPERA, não o que já foi resolvido.
    assert.equal((await store.ReviewDesk({ project: p.id })).counts.plans, 0)
})

// O plano PRECISA validar com as regras do aceite. Aceitar era o único caminho
// de saída, e um valor que só `CreateItem` recusa produzia um plano impossível:
// o humano lia a árvore inteira, clicava em Aceitar, recebia erro sobre um campo
// que não escreveu, e não tinha alternativa senão recusar o que queria aprovar.
test("MPMR plano com campo que o aceite recusa é barrado na PROPOSTA, não no aceite", async () => {
    const p = await store.CreateProject({ name: "Plano válido", keyPrefix: "PLVA", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "pln-val" } }

    // O CASO REAL: "M" maiúsculo passou na proposta e explodiu no aceite, porque
    // `CreateItem` só admite ["xs","s","m","l","xl"]. Agora é normalizado na
    // entrada — e a prova de que o buraco fechou é o aceite funcionando.
    const caixaAlta = await store.ProposePlan({
        project: p.id, title: "Esforço em caixa alta",
        nodes: [
            { ref: "a", type: "TASK", title: "Primeiro", effort: "M", value: "HIGH" },
            { parentRef: "a", type: "task", title: "Segundo", effort: "S" }
        ],
        actor: agente
    })
    const primeiro = caixaAlta.nodes.find((n) => n.title === "Primeiro")
    assert.equal(primeiro.effort, "m", "a caixa é normalizada na proposta")
    assert.equal(primeiro.type, "task")
    assert.equal(primeiro.value, "high")

    const aceito = await store.AcceptPlan({ plan: caixaAlta.id, actor: { source: "api" } })
    assert.equal(aceito.status, "accepted", "o aceite era o único caminho de saída e precisa funcionar")
    assert.equal(aceito.createdItems, 2)

    // Valor que não existe em caixa nenhuma: barrado na PROPOSTA.
    await assert.rejects(
        () => store.ProposePlan({
            project: p.id, title: "Esforço inexistente",
            nodes: [{ type: "task", title: "Fazer", effort: "enorme" }],
            actor: agente
        }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.field === "effort",
        "recusado antes de virar plano, não depois de o humano decidir")

    // Nada meio gravado: o plano inteiro é validado antes de qualquer escrita.
    assert.ok(!(await store.ListPlans({ project: p.id })).some((pl) => pl.title === "Esforço inexistente"))

    // E a validação vale para o lote todo, não só para o primeiro nó.
    await assert.rejects(
        () => store.ProposePlan({
            project: p.id, title: "Segundo nó inválido",
            nodes: [{ type: "task", title: "Bom", effort: "s" }, { type: "inventado", title: "Ruim" }],
            actor: agente
        }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.field === "type" && e.details.index === 1)
    assert.ok(!(await store.ListPlans({ project: p.id })).some((pl) => pl.title === "Segundo nó inválido"),
        "um plano meio gravado é pior que um plano recusado")

    // Editar para um valor que o aceite recusa também é barrado na edição.
    const outro = await store.ProposePlan({
        project: p.id, title: "Para editar",
        nodes: [{ type: "task", title: "Editável", effort: "s" }],
        actor: agente
    })
    await assert.rejects(
        () => store.RevisePlan({ plan: outro.id, node: outro.nodes[0].id, updates: { effort: "gigante" }, actor: { source: "gui" } }),
        (e) => e.code === "VALIDATION_ERROR" && e.details.field === "effort")
    // A edição válida em caixa alta passa, normalizada.
    const editado = await store.RevisePlan({ plan: outro.id, node: outro.nodes[0].id, updates: { effort: "XL" }, actor: { source: "gui" } })
    assert.equal(editado.nodes[0].effort, "xl")
    assert.equal(editado.nodes[0].title, "Editável", "editar um campo não reescreve os outros")
})

// ── COLETA DE EVIDÊNCIA (MPMR F2) ───────────────────────────────────────────
// Estes testes usam um repositório git DE VERDADE (criado no diretório temporário)
// e um runner de verificação local. É o único jeito de provar que a correlação
// commit↔item funciona: um dublê de git provaria só que o dublê responde.

const { execFileSync } = require("child_process")
const CORE_GIT_LIB = "/home/kadisk/Workspaces/meta-platform-repo/repos/ecosystem-core-repository/Main.Module/Libraries.layer/git-status.lib"

const _makeRepo = (nome) => {
    const repo = path.join(TMP, nome)
    fs.mkdirSync(repo, { recursive: true })
    const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: ["ignore", "pipe", "ignore"] })
    git("init", "-q")
    git("config", "user.email", "teste@exemplo.com")
    git("config", "user.name", "Teste")
    return { repo, commit: (arquivo, conteudo, mensagem) => {
        fs.writeFileSync(path.join(repo, arquivo), conteudo)
        git("add", arquivo); git("commit", "-q", "-m", mensagem)
    } }
}

const _storeComEvidencia = async (nome) => {
    const db = path.join(TMP, `${nome}.sqlite`)
    const gitLib = { require: (m) => require(path.join(CORE_GIT_LIB, "src", m)) }
    const runVerification = ({ command, args, cwd }) => new Promise((resolve) => {
        const inicio = Date.now()
        require("child_process").execFile(command, args, { cwd, timeout: 10000 }, (err, stdout, stderr) =>
            resolve({ exitCode: err ? (err.code || 1) : 0, output: (stdout || "") + (stderr || ""), durationMs: Date.now() - inicio }))
    })
    const s = InitializeProjectStore({ storage: db, attachmentsDirPath: ATT_DIR, gitLib, runVerification })
    await s.ConnectAndSync()
    return s
}

test("MPMR-19 commit que cita a chave vira evidência forte; sem a chave, cai para a janela e se declara fraco", async () => {
    const s = await _storeComEvidencia("ev-git")
    const { repo, commit } = _makeRepo("repo-ev")
    const p = await s.CreateProject({ name: "Com repo", keyPrefix: "CRP", status: "active", localPath: repo, actor: { source: "cli" } })
    await s.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "ev-git" } }

    const comChave = await s.CreateItem({ project: p.id, type: "task", title: "Com chave", actor: { source: "cli" } })
    await s.ClaimItem({ item: comChave.id, actor: agente })
    commit("a.js", "console.log(1)\n", `feat: implementa ${comChave.key}`)
    const d1 = await s.SubmitDelivery({ item: comChave.id, summary: "feito", actor: agente })
    const commits1 = d1.evidence.filter((e) => e.kind === "commit")
    assert.equal(commits1.length, 1)
    assert.equal(commits1[0].attribution, "key")
    assert.equal(commits1[0].confidence, "high")
    assert.ok(d1.evidence.some((e) => e.kind === "file" && e.ref === "a.js"), "os arquivos do commit entram como evidência")

    const semChave = await s.CreateItem({ project: p.id, type: "task", title: "Sem chave", actor: { source: "cli" } })
    await s.ClaimItem({ item: semChave.id, actor: agente })
    commit("b.js", "console.log(2)\n", "ajuste rápido")
    const d2 = await s.SubmitDelivery({ item: semChave.id, summary: "feito", actor: agente })
    assert.ok(d2.evidence.filter((e) => e.kind === "commit").every((e) => e.attribution === "window"),
        "sem a chave, a correlação é por tempo")
    assert.ok(d2.evidence.filter((e) => e.kind === "commit").every((e) => e.confidence === "low"),
        "e ela se declara fraca em vez de fingir certeza")
    assert.ok(d2.gaps.some((g) => g.ref === "commit-sem-key" && g.severity === "blocking"))
    await s.sequelize.close()
})

test("MPMR-20 a verificação é executada pelo sistema: exit code entra na evidência", async () => {
    const s = await _storeComEvidencia("ev-verify")
    const { repo, commit } = _makeRepo("repo-verify")
    const p = await s.CreateProject({ name: "Verificado", keyPrefix: "VRF", status: "active", localPath: repo,
        verifyCommand: 'node -e "console.log(\'12 passed\')"', actor: { source: "cli" } })
    await s.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "ev-vrf" } }

    // Caminho feliz COMPLETO: commit com a chave + verificação verde + critério
    // atendido. Só assim a evidência vale "verified".
    const ok = await s.CreateItem({ project: p.id, type: "task", title: "Tudo certo", actor: { source: "cli" } })
    const criterio = await s.AddAcceptanceCriteria({ item: ok.id, text: "passa nos testes" })
    await s.UpdateAcceptanceCriteria({ criteria: criterio.id, met: true })
    await s.ClaimItem({ item: ok.id, actor: agente })
    commit("ok.js", "1\n", `fix: ${ok.key} resolvido`)
    const d1 = await s.SubmitDelivery({ item: ok.id, summary: "feito", actor: agente })
    const v1 = d1.evidence.find((e) => e.kind === "verification")
    assert.ok(v1, "a verificação vira evidência")
    assert.equal(v1.exitCode, 0)
    assert.ok(/12 passed/.test(v1.body), "a saída do comando é guardada")
    assert.equal(d1.evidenceQuality, "verified", "chave + verificação verde + critérios atendidos = verificada")

    // Verificação que FALHA é lacuna bloqueante — e o agente é avisado na hora,
    // antes de o humano devolver por isso.
    const ruim = await s.CreateItem({ project: p.id, type: "task", title: "Quebrado",
        verifyCommand: 'node -e "process.exit(3)"', actor: { source: "cli" } })
    await s.ClaimItem({ item: ruim.id, actor: agente })
    commit("ruim.js", "2\n", `wip: ${ruim.key}`)
    const d2 = await s.SubmitDelivery({ item: ruim.id, summary: "acho que quebrou", actor: agente })
    const v2 = d2.evidence.find((e) => e.kind === "verification")
    assert.equal(v2.exitCode, 3)
    assert.equal(v2.severity, "blocking")
    assert.ok(d2.gaps.some((g) => g.ref === "verificacao-falhou" && g.severity === "blocking"))
    assert.ok(d2.warnings && d2.warnings.length, "o agente é avisado do que ficou frouxo")
    assert.equal(d2.verifyExitCode, 3)
    await s.sequelize.close()
})

test("MPMR-21 a ausência é registrada como fato: sem repo, sem comando, sem critério", async () => {
    const s = await _storeComEvidencia("ev-gaps")
    const p = await s.CreateProject({ name: "Sem nada", keyPrefix: "SNA", status: "active", actor: { source: "cli" } })
    await s.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "ev-gap" } }
    const item = await s.CreateItem({ project: p.id, type: "task", title: "Nada declarado", actor: { source: "cli" } })

    const d = await s.SubmitDelivery({ item: item.id, summary: "confia", actor: agente })
    assert.equal(d.evidenceQuality, "none", "sem repositório não há o que apurar")
    const refs = d.gaps.map((g) => g.ref)
    assert.ok(refs.includes("repo-nao-declarado"))
    assert.ok(refs.includes("sem-comando-de-verificacao"))
    assert.ok(refs.includes("sem-criterios"))
    // As lacunas ficam na MESMA tabela da evidência: o revisor não olha em dois lugares.
    const guardadas = await s.models.DeliveryEvidence.findAll({ where: { deliveryId: d.id, kind: "gap" } })
    assert.equal(guardadas.length, refs.length)
    await s.sequelize.close()
})

test("MPMR-21 coleta indisponível não derruba a entrega", async () => {
    // Store SEM gitLib e SEM runVerification — o caso de um ambiente onde as
    // duas dependências externas não foram injetadas.
    const s = InitializeProjectStore({ storage: path.join(TMP, "ev-nolib.sqlite"), attachmentsDirPath: ATT_DIR })
    await s.ConnectAndSync()
    const p = await s.CreateProject({ name: "Sem libs", keyPrefix: "SLB", status: "active", actor: { source: "cli" } })
    await s.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const item = await s.CreateItem({ project: p.id, type: "task", title: "Ainda entrega", actor: { source: "cli" } })
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "ev-nolib" } }

    const d = await s.SubmitDelivery({ item: item.id, summary: "entreguei", actor: agente })
    assert.equal(d.status, "ai-review", "a entrega acontece mesmo sem poder apurar nada")
    assert.ok(d.gaps.some((g) => g.ref === "git-indisponivel"))
    await s.sequelize.close()
})

test("MPMR-29 em projeto migrado, concluir por status é recusado também no STORE (não só no MCP)", async () => {
    // O caso que motiva: alguém ARRASTA o card para a coluna de conclusão no
    // board. A GUI chama o store direto, sem passar pelo MCP — e sem esta
    // recusa o item ficaria com statusKey "done" e executionState "queued",
    // voltando a ser oferecido na fila.
    const p = await store.CreateProject({ name: "Arrastar não conclui", keyPrefix: "ARR", status: "active", actor: { source: "cli" } })
    await store.MigrateProjectToDeliveryModel({ project: p.id, actor: { source: "gui" } })
    const item = await store.CreateItem({ project: p.id, type: "task", title: "Card arrastável", actor: { source: "cli" } })

    // Humano, pela GUI — o caminho do arrastar.
    await assert.rejects(
        () => store.SetStatus({ item: item.id, status: "done", actor: { source: "gui" } }),
        (e) => e.code === "MODEL_MIGRATED" && e.details.replacement === "AcceptDelivery")

    // As transições que NÃO concluem continuam livres (arrastar para "em
    // progresso" é legítimo).
    const movido = await store.SetStatus({ item: item.id, status: "in-progress", actor: { source: "gui" } })
    assert.equal(movido.statusKey, "in-progress")

    // E o caminho de DENTRO do fluxo de entrega continua funcionando: é ele que
    // conclui de verdade, mantendo os dois eixos coerentes.
    const agente = { source: "agent", session: { provider: "claude", modelName: "claude-opus-5", traceId: "arr-1" } }
    const entrega = await store.SubmitDelivery({ item: item.id, summary: "feito", actor: agente })
    await store.AcceptDelivery({ delivery: entrega.id, actor: { source: "gui" } })
    const final = await store.GetItem({ item: item.id })
    assert.equal(final.statusKey, "done")
    assert.equal(final.executionState, "done")
    assert.equal(final.reviewState, "accepted")

    // Projeto legado segue aceitando a mudança direta de status.
    const legado = await store.CreateProject({ name: "Arrastar legado", keyPrefix: "ARL", status: "active", actor: { source: "cli" } })
    const i2 = await store.CreateItem({ project: legado.id, type: "task", title: "Card antigo", actor: { source: "cli" } })
    assert.equal((await store.SetStatus({ item: i2.id, status: "done", actor: { source: "gui" } })).statusKey, "done")
})
