const { NewId, Serialize, SerializeMany } = require("../Utils/helpers")
const { DomainError } = require("../Errors")
const { AGENT_PROVIDERS } = require("../Config")

const AgentsStore = (ctx) => {
    const { models, writeAudit, emit, store } = ctx
    const { AgentProfile, AgentSession, User } = models

    // Cria um usuário-agente + seu AgentProfile (spec §5.2). Dois agentes do mesmo
    // provider com donos humanos diferentes = usuários-agente distintos.
    const CreateAgent = async ({ provider = "other", owner, name, displayName, handle, defaultModel, externalAgentId, description, actor } = {}) => {
        if(!AGENT_PROVIDERS.includes(provider))
            throw new DomainError("VALIDATION_ERROR", `Provider inválido: ${provider}.`, { field: "provider", allowed: AGENT_PROVIDERS })
        const finalName = displayName || name || `${provider} / ${owner || "?"}`
        const ownerHumanUserId = owner ? (await store.ResolveUser(owner)).id : undefined

        const agentUser = await store.CreateUser({ type: "agent", displayName: finalName, handle, actor })
        const profile = await AgentProfile.create({
            id: NewId(), userId: agentUser.id, provider, ownerHumanUserId, externalAgentId, defaultModel, description
        })
        const data = { ...Serialize(profile), user: agentUser }
        await writeAudit({ entityType: "agent-profile", entityId: profile.id, action: "create", actor, metadata: { provider, ownerHumanUserId } })
        return data
    }

    const ResolveAgent = async (ref) => {
        // ref pode ser id do profile, id/handle do usuário-agente.
        let profile = await AgentProfile.findOne({ where: { id: ref } })
        if(!profile){
            const user = await store.ResolveUser(ref).catch(() => undefined)
            if(user) profile = await AgentProfile.findOne({ where: { userId: user.id } })
        }
        if(!profile) throw new DomainError("NOT_FOUND", `Agente "${ref}" não encontrado.`, { ref })
        return profile
    }

    const ListAgents = async () => {
        const rows = await AgentProfile.findAll({ order: [["createdAt", "ASC"]] })
        const result = []
        for(const p of rows){
            const user = await User.findOne({ where: { id: p.userId } })
            result.push({ ...Serialize(p), user: user ? Serialize(user) : undefined })
        }
        return result
    }

    const GetAgent = async ({ agent } = {}) => {
        const profile = await ResolveAgent(agent)
        const user = await User.findOne({ where: { id: profile.userId } })
        return { ...Serialize(profile), user: user ? Serialize(user) : undefined }
    }

    // Registra uma sessão de agente. Sem confirm -> pending_confirmation (spec §5.4).
    const RegisterSession = async ({
        agent, model, modelName, modelProvider, sessionName, description, externalSessionId,
        sessionUrl, traceId, workingDirectory, repositoryUrl, branchName, objective, confirm = false, actor
    } = {}) => {
        const profile = await ResolveAgent(agent)
        const finalModel = modelName || model || profile.defaultModel
        if(!finalModel) throw new DomainError("VALIDATION_ERROR", "Modelo da sessão é obrigatório.", { field: "model" })

        const status = confirm ? "active" : "pending_confirmation"
        const session = await AgentSession.create({
            id: NewId(),
            agentUserId: profile.userId,
            ownerHumanUserId: profile.ownerHumanUserId,
            provider: profile.provider,
            modelProvider, modelName: finalModel,
            sessionName, description, externalSessionId, sessionUrl, traceId,
            workingDirectory, repositoryUrl, branchName, objective,
            status,
            confirmedAt: confirm ? new Date() : undefined
        })
        const data = Serialize(session)
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: confirm ? "register-confirmed" : "register-pending", actor, metadata: { provider: profile.provider, model: finalModel } })
        emit(confirm ? "agent.session.confirmed" : "agent.session.pending", data)
        return data
    }

    const ResolveSession = async (ref) => {
        const session = await AgentSession.findOne({ where: { id: ref } })
        if(!session) throw new DomainError("NOT_FOUND", `Sessão "${ref}" não encontrada.`, { ref })
        return session
    }

    const ListSessions = async ({ agent, status, limit = 200, offset = 0 } = {}) => {
        const where = {}
        if(agent){ const p = await ResolveAgent(agent); where.agentUserId = p.userId }
        if(status) where.status = status
        const rows = await AgentSession.findAll({ where, order: [["createdAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        return SerializeMany(rows)
    }

    const GetSession = async ({ session } = {}) => Serialize(await ResolveSession(session))

    const ConfirmSession = async ({ session, actor } = {}) => {
        const instance = await ResolveSession(session)
        await instance.update({ status: "active", confirmedAt: new Date() })
        const data = Serialize(instance)
        await writeAudit({ entityType: "agent-session", entityId: instance.id, action: "confirm", actor })
        emit("agent.session.confirmed", data)
        return data
    }

    const RejectSession = async ({ session, actor } = {}) => {
        const instance = await ResolveSession(session)
        await instance.update({ status: "rejected", closedAt: new Date() })
        await writeAudit({ entityType: "agent-session", entityId: instance.id, action: "reject", actor })
        return Serialize(instance)
    }

    const CloseSession = async ({ session, actor } = {}) => {
        const instance = await ResolveSession(session)
        await instance.update({ status: "closed", closedAt: new Date() })
        await writeAudit({ entityType: "agent-session", entityId: instance.id, action: "close", actor })
        return Serialize(instance)
    }

    // ---------- Gate de criação estrutural por agente (identidade inline) ----------
    // Regra: TODA criação de projeto ou board por um agente exige autorização
    // humana (mesmo com sessão já confirmada antes). Itens (histórias/tarefas) e
    // mudança de status NÃO passam pelo gate. A criação vira um pedido PENDENTE;
    // ao ser aprovada, é executada de fato.

    const { CreationRequest, Project, Board, WorkItem, Attachment, Comment } = models

    // Resolve (ou cria) o usuário-agente para uma identidade inline.
    const _resolveAgentUserForIdentity = async ({ provider = "other", agent, owner }) => {
        if(agent){
            const profile = await ResolveAgent(agent).catch(() => undefined)
            if(profile) return profile.userId
        }
        const handle = `${provider}-${owner || "auto"}`.toLowerCase().replace(/[^a-z0-9-]/g, "-")
        const existing = await User.findOne({ where: { handle, deletedAt: null } })
        if(existing) return existing.id
        const created = await CreateAgent({ provider, owner, name: `${provider} / ${owner || "auto"}`, handle })
        return created.userId
    }

    // Chave estável de identidade da sessão (provider + externalSessionId||traceId||host:pid).
    const _identityKey = (s) =>
        `${s.provider || "other"}:${s.externalSessionId || s.traceId || `${s.host || "?"}:${s.pid || "?"}`}`

    // Encontra a sessão pela identidade; cria se nova, capturando todo o contexto.
    const ResolveOrCreateSessionByIdentity = async (identity = {}, action) => {
        const identityKey = _identityKey(identity)
        let session = await AgentSession.findOne({ where: { identityKey } })
        if(session) return session
        const agentUserId = await _resolveAgentUserForIdentity(identity)
        const now = new Date()
        session = await AgentSession.create({
            id: NewId(),
            agentUserId,
            ownerHumanUserId: identity.ownerHumanUserId,
            provider: identity.provider || "other",
            modelProvider: identity.modelProvider,
            modelName: identity.model || identity.modelName || "unknown",
            sessionName: identity.sessionName,
            description: identity.description,
            externalSessionId: identity.externalSessionId,
            sessionUrl: identity.sessionUrl,
            traceId: identity.traceId,
            workingDirectory: identity.workingDirectory,
            repositoryUrl: identity.repositoryUrl,
            branchName: identity.branchName,
            commitHash: identity.commitHash,
            objective: identity.objective,
            identityKey,
            host: identity.host,
            osUser: identity.osUser,
            pid: identity.pid,
            agentVersion: identity.agentVersion,
            firstAttemptAt: now,
            firstAttemptAction: action,
            actionCount: 0,
            lastActivityAt: now,
            status: "active"
        })
        await writeAudit({ entityType: "agent-session", entityId: session.id, action: "detected", actor: { source: "agent", actorSessionId: session.id }, metadata: { identityKey, firstAttemptAction: action } })
        return session
    }

    // Um actor é "agente inline" (sujeito ao gate) quando traz identidade de sessão.
    const IsAgentActor = (actor) => !!(actor && actor.session)
    const IsAgentCreation = IsAgentActor // alias retrocompatível (gate de criação)

    // Cria um pedido de APROVAÇÃO pendente (não executa a ação ainda). Usado pelos
    // gates de create (project/board/milestone/sprint) e de delete (project/board/item).
    // Idempotência opcional via resumeToken. Retorna { request, session }.
    const RequestApproval = async ({
        actionName = "create", type, targetId, payload = {}, projectId,
        risk = "normal", resumeToken, actor
    } = {}) => {
        const session = await ResolveOrCreateSessionByIdentity(actor.session || {}, `${actionName}-${type}`)
        await session.update({ actionCount: session.actionCount + 1, lastActivityAt: new Date() })

        // Idempotência: reusa o pedido PENDENTE de mesmo token (evita duplicar por retry).
        if(resumeToken){
            const existing = await CreationRequest.findOne({ where: { resumeToken, status: "pending" } })
            if(existing) return { request: existing, session, reused: true }
        }

        const request = await CreationRequest.create({
            id: NewId(), type, actionName, targetType: type, targetId, risk,
            agentSessionId: session.id, projectId,
            provider: session.provider, model: session.modelName, traceId: session.traceId,
            resumeToken,
            status: "pending", payloadJson: JSON.stringify(payload), requestedAt: new Date()
        })
        await writeAudit({ projectId, entityType: "creation-request", entityId: request.id, action: "request", actor: { source: "agent", actorSessionId: session.id }, metadata: { actionName, type, targetId, risk, payload } })
        const wire = { type, actionName, request: Serialize(request), session: Serialize(session), payload }
        emit("agent.session.pending", wire) // retrocompat (GUI recarrega em 'pending')
        emit("approval.requested", wire)
        return { request, session }
    }

    // Gate único de aprovação: se o ator é um AGENTE, a ação sensível não roda —
    // vira um pedido pendente e a chamada lança AGENT_SESSION_CONFIRMATION_REQUIRED
    // (a camada MCP bloqueia nesse ponto até a decisão humana). Humanos e a CLI
    // passam direto. Chame no início do método do store que precisa de gate.
    const GateAgentAction = async ({ actionName, type, targetId, projectId, payload = {}, risk = "normal", reason, actor } = {}) => {
        if(!IsAgentActor(actor)) return
        const { request } = await RequestApproval({
            actionName, type, targetId, projectId, payload, risk,
            resumeToken: actor.resumeToken, actor
        })
        throw new DomainError("AGENT_SESSION_CONFIRMATION_REQUIRED",
            reason || `Esta ação (${actionName} ${type}) por agente requer aprovação humana.`,
            {
                pendingCreationId: request.id, actionName, type,
                nextCommands: [`mpm agent creation approve ${request.id}`, `mpm agent creation reject ${request.id}`]
            })
    }

    // Retrocompat: criação estrutural = pedido com actionName "create".
    // resumeToken precisa atravessar: é ele que faz um retry do agente reusar o
    // pedido pendente em vez de criar outro.
    const RequestCreation = async ({ type, payload = {}, projectId, resumeToken, actor } = {}) =>
        RequestApproval({ actionName: "create", type, payload, projectId, risk: "normal", resumeToken, actor })

    const ResolveCreationRequest = async (ref) => {
        const req = await CreationRequest.findOne({ where: { id: ref } })
        if(!req) throw new DomainError("NOT_FOUND", `Pedido de aprovação "${ref}" não encontrado.`, { ref })
        return req
    }

    // Impacto de uma deleção (soft delete): "o QUE será afetado". Usado pela GUI/CLI
    // para o humano entender a consequência antes de aprovar. Não deleta nada.
    const DescribeDeletionImpact = async ({ type, targetId } = {}) => {
        if(type === "project"){
            const project = await Project.findOne({ where: { id: targetId } })
            if(!project) return undefined
            const [boards, items, attachments, comments] = await Promise.all([
                Board.count({ where: { projectId: targetId, deletedAt: null } }),
                WorkItem.count({ where: { projectId: targetId, deletedAt: null } }),
                Attachment.count({ where: { projectId: targetId, deletedAt: null } }),
                Comment.count({ where: { projectId: targetId, deletedAt: null } })
            ])
            return { targetType: "project", targetLabel: `${project.keyPrefix} · ${project.name}`, counts: { boards, items, attachments, comments } }
        }
        if(type === "board"){
            const board = await Board.findOne({ where: { id: targetId } })
            if(!board) return undefined
            const items = await WorkItem.count({ where: { boardId: targetId, deletedAt: null } })
            return { targetType: "board", targetLabel: board.name, counts: { items } }
        }
        if(type === "item" || type === "work-item"){
            const item = await WorkItem.findOne({ where: { id: targetId } })
            if(!item) return undefined
            const [children, comments, attachments] = await Promise.all([
                WorkItem.count({ where: { parentId: targetId, deletedAt: null } }),
                Comment.count({ where: { workItemId: targetId, deletedAt: null } }),
                Attachment.count({ where: { workItemId: targetId, deletedAt: null } })
            ])
            return { targetType: "item", targetLabel: `${item.key} · ${item.title}`, counts: { children, comments, attachments } }
        }
        return undefined
    }

    // "Quem" fez o pedido: identidade do agente (provider/modelo/sessão/objetivo).
    const _describeWho = (session, req) => session ? {
        agentUserId: session.agentUserId, provider: session.provider, model: session.modelName,
        sessionId: session.id, traceId: session.traceId, objective: session.objective,
        host: session.host, osUser: session.osUser
    } : { provider: req.provider, model: req.model, traceId: req.traceId }

    // Aprova um pedido pendente e EXECUTA a ação de fato (create OU delete). A execução
    // usa um actor sem `.session` para não re-disparar o gate. Falha => status "failed".
    // Toda ação que pode ficar pendente de aprovação sabe se reexecutar aqui.
    // Chave: `${actionName}:${type}` — o mesmo par usado ao criar o pedido.
    const APPROVAL_EXECUTORS = {
        "create:project":   ({ payload, actor }) => store.CreateProject({ ...payload, actor }),
        "create:board":     ({ payload, actor }) => store.CreateBoard({ ...payload, actor }),
        "create:milestone": ({ payload, actor }) => store.CreateMilestone({ ...payload, actor }),
        "create:sprint":    ({ payload, actor }) => store.CreateSprint({ ...payload, actor }),

        "delete:project":   ({ targetId, actor }) => store.DeleteProject({ project: targetId, actor }),
        "delete:board":     ({ targetId, actor }) => store.DeleteBoard({ board: targetId, actor }),
        "delete:item":      ({ targetId, actor }) => store.DeleteItem({ item: targetId, actor }),
        "delete:work-item": ({ targetId, actor }) => store.DeleteItem({ item: targetId, actor }),
        "delete:milestone": ({ targetId, actor }) => store.DeleteMilestone({ milestone: targetId, actor }),
        "delete:sprint":    ({ targetId, actor }) => store.DeleteSprint({ sprint: targetId, actor }),
        "delete:column":    ({ targetId, actor }) => store.DeleteColumn({ column: targetId, actor }),
        "delete:checklist-item":      ({ targetId, actor }) => store.RemoveChecklistItem({ checklistItem: targetId, actor }),
        "delete:acceptance-criteria": ({ targetId, actor }) => store.RemoveAcceptanceCriteria({ criteria: targetId, actor }),

        // Reescrita de texto do projeto e mudança de ciclo de vida.
        "update:project":   ({ payload, targetId, actor }) => store.UpdateProject({ ...payload, project: targetId, actor }),
        "archive:project":  ({ targetId, actor }) => store.ArchiveProject({ project: targetId, actor }),
        "restore:project":  ({ targetId, actor }) => store.RestoreProject({ project: targetId, actor }),

        // Estrutura do board: colunas e board padrão.
        "create:column":    ({ payload, actor }) => store.AddColumn({ ...payload, actor }),
        "update:column":    ({ payload, targetId, actor }) => store.UpdateColumn({ ...payload, column: targetId, actor }),
        "move:column":      ({ payload, targetId, actor }) => store.MoveColumn({ column: targetId, order: payload.order, actor }),
        "set-default:board": ({ targetId, actor }) => store.SetDefaultBoard({ board: targetId, actor })
    }

    // Quem decide um pedido é sempre uma pessoa: a GUI e a CLI rodam no desktop e
    // não têm login, então chegam sem `actorUserId` e a decisão acabaria gravada
    // como `system`. Sem usuário explícito, atribui ao usuario-desktop — mesma
    // precedência de AddActivityNote.
    //
    // Um ator com identidade de agente NUNCA recebe o fallback: se recebesse,
    // um agente que chamasse approve pela CLI apareceria na auditoria como
    // decisão humana. Ele continua gravado como `agent`, e o gate segue visível.
    const _resolveDecider = async (actor = {}) => {
        if(actor.actorUserId) return { ...actor, actorType: actor.actorType || "human" }
        if(actor.session || actor.source === "agent" || actor.source === "mcp") return actor
        const desktop = await store.EnsureDesktopUser()
        return { ...actor, actorUserId: desktop.id, actorType: "desktop" }
    }

    const ApproveRequest = async ({ request, actor } = {}) => {
        const req = await ResolveCreationRequest(request)
        if(req.status !== "pending")
            throw new DomainError("VALIDATION_ERROR", `Pedido já ${req.status}.`, { status: req.status })
        const payload = req.payloadJson ? JSON.parse(req.payloadJson) : {}
        const actionName = req.actionName || "create"
        const decider = await _resolveDecider(actor)
        const execActor = { source: "agent", actorSessionId: req.agentSessionId, actorUserId: decider.actorUserId }

        // Executor por (ação:tipo). O ator de execução NÃO tem `session`, então
        // os gates não disparam de novo — é a decisão humana que está sendo aplicada.
        const executor = APPROVAL_EXECUTORS[`${actionName}:${req.type}`]
        if(!executor)
            throw new DomainError("VALIDATION_ERROR", `Pedido não executável: ${actionName} ${req.type}.`, { actionName, type: req.type })

        let result
        try {
            result = await executor({ payload, targetId: req.targetId, actor: execActor })
        } catch(err){
            const snapshot = err && typeof err.toResponse === "function" ? err.toResponse() : { message: err && err.message }
            await req.update({ status: "failed", decidedAt: new Date(), decidedByUserId: decider.actorUserId, errorSnapshot: JSON.stringify(snapshot) })
            await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "execute-failed", actor: decider, metadata: { actionName, type: req.type, error: snapshot.message } })
            emit("approval.failed", { request: Serialize(await req.reload()), error: snapshot })
            throw err
        }

        await req.update({
            status: "approved", resultId: result && result.id, resultSnapshot: JSON.stringify(result),
            decidedAt: new Date(), executedAt: new Date(), decidedByUserId: decider.actorUserId
        })
        await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "approve", actor: decider, metadata: { actionName, type: req.type, resultId: result && result.id } })
        const data = Serialize(await req.reload())
        emit("agent.session.confirmed", { request: data, result }) // retrocompat
        emit("approval.approved", { request: data, result })
        emit("approval.executed", { request: data, result })
        return { request: data, result }
    }
    const ApproveCreation = ApproveRequest // alias retrocompatível

    const RejectRequest = async ({ request, reason, actor } = {}) => {
        const req = await ResolveCreationRequest(request)
        if(req.status !== "pending")
            throw new DomainError("VALIDATION_ERROR", `Pedido já ${req.status}.`, { status: req.status })
        const decider = await _resolveDecider(actor)
        await req.update({ status: "rejected", decidedAt: new Date(), decidedByUserId: decider.actorUserId, rejectionReason: reason })
        await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "reject", actor: decider, metadata: { reason } })
        const data = Serialize(await req.reload())
        emit("approval.rejected", { request: data })
        return data
    }
    const RejectCreation = RejectRequest // alias retrocompatível

    // Aguarda (polling do SQLite; processos separados via WAL) até o pedido sair de
    // "pending". Retorna o pedido final + result/error. timeoutMs=0 => sem timeout.
    const WaitForApproval = async ({ request, timeoutMs = 0, pollMs = 1000 } = {}) => {
        const started = Date.now()
        for(;;){
            const req = await CreationRequest.findOne({ where: { id: request } })
            if(!req) throw new DomainError("NOT_FOUND", `Pedido de aprovação "${request}" não encontrado.`, { ref: request })
            if(req.status !== "pending"){
                const out = Serialize(req)
                out.result = req.resultSnapshot ? JSON.parse(req.resultSnapshot) : (req.resultId ? { id: req.resultId } : undefined)
                out.error = req.errorSnapshot ? JSON.parse(req.errorSnapshot) : undefined
                return out
            }
            if(timeoutMs > 0 && Date.now() - started >= timeoutMs)
                return { ...Serialize(req), timedOut: true }
            await new Promise((resolve) => setTimeout(resolve, pollMs))
        }
    }

    // Detalhe completo de um pedido: payload + sessão + "quem" + impacto (se delete).
    const DescribeCreationRequest = async ({ request } = {}) => {
        const req = await ResolveCreationRequest(request)
        const session = req.agentSessionId ? await AgentSession.findOne({ where: { id: req.agentSessionId } }) : undefined
        const payload = req.payloadJson ? JSON.parse(req.payloadJson) : {}
        let impact
        if((req.actionName || "create") === "delete")
            impact = await DescribeDeletionImpact({ type: req.type, targetId: req.targetId }).catch(() => undefined)
        return { ...Serialize(req), payload, session: session ? Serialize(session) : undefined, who: _describeWho(session, req), impact }
    }

    // status "all" (ou vazio) => histórico completo. `agent` filtra pelo usuário-agente
    // (via suas sessões) e `session` por uma sessão específica.
    const ListCreationRequests = async ({ type, actionName, status = "pending", agent, session, projectId, limit = 200, offset = 0 } = {}) => {
        const where = {}
        if(type) where.type = type
        if(actionName) where.actionName = actionName
        if(status && status !== "all") where.status = status
        if(projectId) where.projectId = projectId
        if(session) where.agentSessionId = session
        else if(agent){
            const profile = await ResolveAgent(agent).catch(() => undefined)
            const agentUserId = profile ? profile.userId : agent
            const sessions = await AgentSession.findAll({ where: { agentUserId }, attributes: ["id"] })
            where.agentSessionId = sessions.map((s) => s.id)
        }
        const rows = await CreationRequest.findAll({ where, order: [["requestedAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        // Enriquecer com sessão, "quem" e (p/ delete) o impacto — a GUI mostra o QUE e QUEM.
        const out = []
        for(const r of rows){
            const s = r.agentSessionId ? await AgentSession.findOne({ where: { id: r.agentSessionId } }) : undefined
            let impact
            if((r.actionName || "create") === "delete")
                impact = await DescribeDeletionImpact({ type: r.type, targetId: r.targetId }).catch(() => undefined)
            out.push({ ...Serialize(r), payload: r.payloadJson ? JSON.parse(r.payloadJson) : {}, session: s ? Serialize(s) : undefined, who: _describeWho(s, r), impact })
        }
        return out
    }

    return {
        CreateAgent, ResolveAgent, ListAgents, GetAgent,
        RegisterSession, ResolveSession, ListSessions, GetSession,
        ConfirmSession, RejectSession, CloseSession,
        ResolveOrCreateSessionByIdentity, IsAgentActor, IsAgentCreation,
        RequestApproval, RequestCreation, GateAgentAction,
        ApproveRequest, ApproveCreation, RejectRequest, RejectCreation,
        WaitForApproval, DescribeCreationRequest, DescribeDeletionImpact,
        ListCreationRequests
    }
}

module.exports = AgentsStore
