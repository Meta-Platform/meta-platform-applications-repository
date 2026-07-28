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
    // A liberação aceita CORRIGIR provedor/modelo declarados: é o momento em que
    // o humano vê quem está entrando e conserta o que a configuração do cliente
    // errou (ela é fixa e envelhece). A correção vale para a sessão inteira.
    const ConfirmAgentSession = async (arg = {}) => Guard(async () => {
        await ctx.ready
        const id = idOf(arg, "sessionId")
        return store.ConfirmSession({ session: id, provider: arg.provider, model: arg.model, actor: { source: "api" } })
    })
    const RejectAgentSession = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "sessionId"); return store.RejectSession({ session: id, actor: { source: "api" } }) })
    const CloseAgentSession = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "sessionId"); return store.CloseSession({ session: id, actor: { source: "api" } }) })

    // Pedidos de aprovação (criação/remoção) feitos por agentes (gate de agente).
    // A listagem já vem enriquecida com "who" (provider/modelo/sessão) e, para delete,
    // "impact" (o QUE será afetado) — é o que o modal global de aprovação exibe.
    const ListCreationRequests = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListCreationRequests({ type: p.type, actionName: p.actionName, status: p.status, agent: p.agent, session: p.session, limit: p.limit }) })
    const GetCreationRequest = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "requestId"); return store.DescribeCreationRequest({ request: id }) })
    const ApproveCreation = async (p = {}) => Guard(async () => { await ctx.ready; return store.ApproveRequest({ request: p.requestId, actor: Actor(p) }) })
    // Decidir um CONJUNTO de pedidos de uma vez (MPMX3-8): 74 itens geravam ~150
    // diálogos, e humano que carimba não lê — o oposto do que o gate existe para
    // garantir. Cada pedido é decidido de forma independente no store.
    const DecideCreations = async (p = {}) => Guard(async () => { await ctx.ready; return store.DecideRequests({ requests: p.requests, decision: p.decision, reason: p.reason, actor: Actor(p) }) })
    const RejectCreation = async (p = {}) => Guard(async () => { await ctx.ready; return store.RejectRequest({ request: p.requestId, reason: p.reason, actor: Actor(p) }) })

    // ── Coordenação entre agentes (MPMX3) ──────────────────────────────────
    // A GUI precisa administrar o que o MCP passou a expor aos agentes: quem
    // está presente agora, o que já foi avisado entre sessões e o que anda
    // subindo/caindo no ambiente compartilhado. O humano é quem arbitra quando
    // duas sessões se atropelam — sem enxergar isso, ele arbitra às cegas.
    const WhoIsHere = async (p = {}) => Guard(async () => { await ctx.ready; return store.WhoIsHere({ project: p.project, includeGone: !!p.includeGone, actor: Actor(p) }) })
    const ListAgentNotices = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListNotices({ project: p.project, session: p.session, kind: p.kind, limit: p.limit }) })
    const SendAgentNotice = async (p = {}) => Guard(async () => { await ctx.ready; return store.SendSessionMessage({ toSession: p.toSession, item: p.item, project: p.project, body: p.body, actor: Actor(p) }) })
    const ListEnvironmentActions = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListEnvironmentActions({ project: p.project, limit: p.limit, actor: Actor(p) }) })

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
        CloseAgentSession,
        ListCreationRequests,
        GetCreationRequest,
        ApproveCreation,
        RejectCreation,
        DecideCreations,
        WhoIsHere,
        ListAgentNotices,
        SendAgentNotice,
        ListEnvironmentActions
    }
}

module.exports = AgentsController
