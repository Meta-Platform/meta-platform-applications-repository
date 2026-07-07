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

    const { CreationRequest } = models

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
    const IsAgentCreation = (actor) => !!(actor && actor.session)

    // Cria um pedido de criação PENDENTE (não cria a entidade ainda). Usado por
    // CreateProject/CreateBoard ao detectar actor agente. Retorna { request, session }.
    const RequestCreation = async ({ type, payload = {}, projectId, actor } = {}) => {
        const session = await ResolveOrCreateSessionByIdentity(actor.session || {}, `create-${type}`)
        await session.update({ actionCount: session.actionCount + 1, lastActivityAt: new Date() })
        const request = await CreationRequest.create({
            id: NewId(), type, agentSessionId: session.id, projectId,
            status: "pending", payloadJson: JSON.stringify(payload), requestedAt: new Date()
        })
        await writeAudit({ projectId, entityType: "creation-request", entityId: request.id, action: "request", actor: { source: "agent", actorSessionId: session.id }, metadata: { type, payload } })
        emit("agent.session.pending", { type, request: Serialize(request), session: Serialize(session), payload })
        return { request, session }
    }

    const ResolveCreationRequest = async (ref) => {
        const req = await CreationRequest.findOne({ where: { id: ref } })
        if(!req) throw new DomainError("NOT_FOUND", `Pedido de criação "${ref}" não encontrado.`, { ref })
        return req
    }

    // Aprova um pedido pendente e EXECUTA a criação de fato (projeto ou board).
    // A execução usa um actor sem `.session` para não re-disparar o gate.
    const ApproveCreation = async ({ request, actor } = {}) => {
        const req = await ResolveCreationRequest(request)
        if(req.status !== "pending")
            throw new DomainError("VALIDATION_ERROR", `Pedido já ${req.status}.`, { status: req.status })
        const payload = req.payloadJson ? JSON.parse(req.payloadJson) : {}
        const execActor = { source: "agent", actorSessionId: req.agentSessionId, actorUserId: actor && actor.actorUserId }

        let result
        if(req.type === "project") result = await store.CreateProject({ ...payload, actor: execActor })
        else if(req.type === "board") result = await store.CreateBoard({ ...payload, actor: execActor })
        else throw new DomainError("VALIDATION_ERROR", `Tipo de pedido inválido: ${req.type}.`, { type: req.type })

        await req.update({ status: "approved", resultId: result.id, decidedAt: new Date(), decidedByUserId: actor && actor.actorUserId })
        await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "approve", actor, metadata: { type: req.type, resultId: result.id } })
        const data = Serialize(await req.reload())
        emit("agent.session.confirmed", { request: data, result })
        return { request: data, result }
    }

    const RejectCreation = async ({ request, actor } = {}) => {
        const req = await ResolveCreationRequest(request)
        if(req.status !== "pending")
            throw new DomainError("VALIDATION_ERROR", `Pedido já ${req.status}.`, { status: req.status })
        await req.update({ status: "rejected", decidedAt: new Date(), decidedByUserId: actor && actor.actorUserId })
        await writeAudit({ projectId: req.projectId, entityType: "creation-request", entityId: req.id, action: "reject", actor })
        return Serialize(await req.reload())
    }

    const ListCreationRequests = async ({ type, status = "pending", limit = 200, offset = 0 } = {}) => {
        const where = {}
        if(type) where.type = type
        if(status) where.status = status
        const rows = await CreationRequest.findAll({ where, order: [["requestedAt", "DESC"]], limit: Number(limit), offset: Number(offset) })
        // Enriquecer com todos os detalhes da sessão (para a GUI decidir).
        const out = []
        for(const r of rows){
            const s = r.agentSessionId ? await AgentSession.findOne({ where: { id: r.agentSessionId } }) : undefined
            out.push({ ...Serialize(r), payload: r.payloadJson ? JSON.parse(r.payloadJson) : {}, session: s ? Serialize(s) : undefined })
        }
        return out
    }

    return {
        CreateAgent, ResolveAgent, ListAgents, GetAgent,
        RegisterSession, ResolveSession, ListSessions, GetSession,
        ConfirmSession, RejectSession, CloseSession,
        ResolveOrCreateSessionByIdentity, IsAgentCreation,
        RequestCreation, ApproveCreation, RejectCreation, ListCreationRequests
    }
}

module.exports = AgentsStore
