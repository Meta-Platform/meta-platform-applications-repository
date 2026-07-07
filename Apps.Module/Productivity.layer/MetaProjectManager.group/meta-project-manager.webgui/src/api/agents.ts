import { Caller } from "./client"
import { Agent, AgentSession } from "./types"

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
        call("Agents", "CloseAgentSession", { sessionId })
})

export default CreateAgentsApi
