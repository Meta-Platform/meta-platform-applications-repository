import { Caller } from "./client"
import { Agent, AgentSession, CreationRequest, ApproveCreationResult, AgentPresenceResult, AgentNotice, ActivityNote } from "./types"

export interface CreateAgentInput {
    provider: string
    name?: string
    owner?: string
    handle?: string
    defaultModel?: string
}

export interface CreateAgentSessionInput {
    model?: string
    confirm?: string
}

const CreateAgentsApi = (call: Caller) => ({
    list: (): Promise<Agent[]> =>
        call("Agents", "ListAgents", {}),

    create: (input: CreateAgentInput): Promise<Agent> =>
        call("Agents", "CreateAgent", input),

    get: (agentId: string): Promise<Agent> =>
        call("Agents", "GetAgent", { agentId }),

    createSession: (agentId: string, input: CreateAgentSessionInput = {}): Promise<AgentSession> =>
        call("Agents", "CreateAgentSession", { agentId, ...input }),

    listSessions: (query: { agent?: string; status?: string } = {}): Promise<AgentSession[]> =>
        call("Agents", "ListAgentSessions", query),

    getSession: (sessionId: string): Promise<AgentSession> =>
        call("Agents", "GetAgentSession", { sessionId }),

    // A liberação pode CORRIGIR provedor/modelo declarados pelo agente — a
    // configuração do cliente é fixa e envelhece (registra Opus 5 como opus-4).
    confirmSession: (sessionId: string, fix?: { provider?: string; model?: string }): Promise<AgentSession> =>
        call("Agents", "ConfirmAgentSession", { sessionId, ...(fix || {}) }),

    rejectSession: (sessionId: string): Promise<AgentSession> =>
        call("Agents", "RejectAgentSession", { sessionId }),

    closeSession: (sessionId: string): Promise<AgentSession> =>
        call("Agents", "CloseAgentSession", { sessionId }),

    // Pedidos de aprovação (criação/remoção por agentes, aguardando decisão
    // humana). status default do servidor = pending. A lista já vem com who/impact.
    listCreationRequests: (query: { type?: string; actionName?: string; status?: string; agent?: string; session?: string; limit?: string } = {}): Promise<CreationRequest[]> =>
        call("Agents", "ListCreationRequests", query),

    getCreationRequest: (requestId: string): Promise<CreationRequest> =>
        call("Agents", "GetCreationRequest", { requestId }),

    approveCreation: (requestId: string, actorUserId?: string): Promise<ApproveCreationResult> =>
        call("Agents", "ApproveCreation", { requestId, actorUserId }),

    rejectCreation: (requestId: string, reason?: string, actorUserId?: string): Promise<CreationRequest> =>
        call("Agents", "RejectCreation", { requestId, reason, actorUserId }),

    // ── Coordenação entre sessões (MPMX3) ─────────────────────────────────
    // Presença: quem está trabalhando AGORA, com que itens e pacotes. É a
    // leitura que o humano precisa para arbitrar quando dois agentes colidem.
    whoIsHere: (query: { project?: string; includeGone?: boolean } = {}): Promise<AgentPresenceResult> =>
        call("Agents", "WhoIsHere", query),

    listNotices: (query: { project?: string; session?: string; kind?: string; limit?: number } = {}): Promise<AgentNotice[]> =>
        call("Agents", "ListAgentNotices", query),

    // O humano também fala com um agente: mesmo canal dos avisos entre sessões.
    sendNotice: (input: { toSession?: string; item?: string; project?: string; body: string }): Promise<AgentNotice> =>
        call("Agents", "SendAgentNotice", input),

    listEnvironmentActions: (query: { project?: string; limit?: number } = {}): Promise<ActivityNote[]> =>
        call("Agents", "ListEnvironmentActions", query)
})

export default CreateAgentsApi
