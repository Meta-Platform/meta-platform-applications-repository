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

    return {
        CreateAgent, ResolveAgent, ListAgents, GetAgent,
        RegisterSession, ResolveSession, ListSessions, GetSession,
        ConfirmSession, RejectSession, CloseSession
    }
}

module.exports = AgentsStore
