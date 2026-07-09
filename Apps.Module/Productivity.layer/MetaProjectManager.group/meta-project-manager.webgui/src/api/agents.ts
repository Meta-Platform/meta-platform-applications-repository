import { Caller } from "./client"
import { Agent, AgentSession, CreationRequest, ApproveCreationResult } from "./types"

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

    confirmSession: (sessionId: string): Promise<AgentSession> =>
        call("Agents", "ConfirmAgentSession", { sessionId }),

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
        call("Agents", "RejectCreation", { requestId, reason, actorUserId })
})

export default CreateAgentsApi
