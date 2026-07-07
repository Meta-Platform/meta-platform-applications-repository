const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Agents — adaptador HTTP fino sobre @/project-store.lib.
const AgentsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListAgents = async () => Guard(async () => { await ctx.ready; return store.ListAgents() })
    const CreateAgent = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateAgent({ provider: p.provider, owner: p.owner, name: p.name, handle: p.handle, defaultModel: p.defaultModel, externalAgentId: p.externalAgentId, description: p.description, actor: Actor(p) }) })
    const GetAgent = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "agentId"); return store.GetAgent({ agent: id }) })
    const CreateAgentSession = async (p = {}) => Guard(async () => { await ctx.ready; return store.RegisterSession({ agent: p.agentId, model: p.model, modelProvider: p.modelProvider, sessionName: p.sessionName, description: p.description, sessionUrl: p.sessionUrl, traceId: p.traceId, workingDirectory: p.workingDirectory, repositoryUrl: p.repositoryUrl, branchName: p.branchName, objective: p.objective, confirm: !!p.confirm, actor: Actor(p) }) })
    const ListAgentSessions = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListSessions({ agent: p.agent, status: p.status }) })
    const GetAgentSession = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "sessionId"); return store.GetSession({ session: id }) })
    const ConfirmAgentSession = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "sessionId"); return store.ConfirmSession({ session: id, actor: { source: "api" } }) })
    const RejectAgentSession = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "sessionId"); return store.RejectSession({ session: id, actor: { source: "api" } }) })
    const CloseAgentSession = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "sessionId"); return store.CloseSession({ session: id, actor: { source: "api" } }) })

    return {
        controllerName: "AgentsController",
        ListAgents,
        CreateAgent,
        GetAgent,
        CreateAgentSession,
        ListAgentSessions,
        GetAgentSession,
        ConfirmAgentSession,
        RejectAgentSession,
        CloseAgentSession
    }
}

module.exports = AgentsController
