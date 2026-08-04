import { Caller } from "./client"
import { AgentMandate, AgentPlan, AgentRoleAssignment } from "./types"

// MANDATOS — o escopo que o humano concede, com as condições de parada.
const CreateMandatesApi = (call: Caller) => ({
    list: (projectId: string, status?: string): Promise<AgentMandate[]> =>
        call("Mandates", "ListMandates", { projectId, status }),

    get: (mandateId: string): Promise<AgentMandate> =>
        call("Mandates", "GetMandate", { mandateId }),

    create: (projectId: string, input: Partial<AgentMandate> & { title: string; scope?: any; actorUserId?: string }): Promise<AgentMandate> =>
        call("Mandates", "CreateMandate", { projectId, ...input }),

    extend: (mandateId: string, input: { maxDeliveries?: number; maxUnreviewedDeliveries?: number; maxConsecutiveReturns?: number; expiresAt?: string; note?: string }): Promise<AgentMandate> =>
        call("Mandates", "ExtendMandate", { mandateId, ...input }),

    revoke: (mandateId: string, reason?: string): Promise<AgentMandate> =>
        call("Mandates", "RevokeMandate", { mandateId, reason }),

    listRoles: (project?: string, role?: string): Promise<AgentRoleAssignment[]> =>
        call("Mandates", "ListRoles", { project, role }),

    grantRole: (input: { agent?: string; session?: string; role: string; project?: string; note?: string }): Promise<AgentRoleAssignment> =>
        call("Mandates", "GrantRole", input),

    revokeRole: (assignmentId: string): Promise<AgentRoleAssignment> =>
        call("Mandates", "RevokeRole", { assignmentId })
})

// PLANOS propostos e a MIGRAÇÃO do projeto para o modelo de entrega.
export const CreatePlansApi = (call: Caller) => ({
    list: (projectId: string, status?: string): Promise<AgentPlan[]> =>
        call("Plans", "ListPlans", { projectId, status }),

    get: (planId: string): Promise<AgentPlan> =>
        call("Plans", "GetPlan", { planId }),

    revise: (planId: string, nodeId: string, updates: any): Promise<AgentPlan> =>
        call("Plans", "RevisePlan", { planId, nodeId, updates }),

    // Aceitar cria itens, dependências, rodada e mandato numa decisão só.
    accept: (planId: string, input: { createSprint?: boolean; createMandate?: boolean; actorUserId?: string } = {}): Promise<any> =>
        call("Plans", "AcceptPlan", { planId, ...input }),

    reject: (planId: string, reason?: string): Promise<AgentPlan> =>
        call("Plans", "RejectPlan", { planId, reason }),

    // Ligar/desligar o modelo de entrega. Ação humana e reversível.
    migrateProject: (projectId: string, actorUserId?: string): Promise<any> =>
        call("Plans", "MigrateProject", { projectId, actorUserId }),

    rollbackProject: (projectId: string): Promise<any> =>
        call("Plans", "RollbackProject", { projectId })
})

export default CreateMandatesApi
