import { Caller } from "./client"
import { RiskItem } from "./types"

// Campos de risco aceitos em create/update. "none" em ownerUserId/milestoneId limpa.
export interface RiskInput {
    title?: string
    description?: string
    probability?: string
    impact?: string
    status?: string
    category?: string
    mitigation?: string
    contingency?: string
    ownerUserId?: string | null
    milestoneId?: string | null
}

// Registro de riscos do projeto (matriz 3×3). Os métodos de escrita começam com
// Create/Update/Delete → o guard de projeto arquivado (client.ts) os bloqueia
// automaticamente.
const CreateRisksApi = (call: Caller) => ({
    list: (projectId: string): Promise<RiskItem[]> =>
        call("Risks", "ListRisks", { projectId }),

    get: (riskId: string): Promise<RiskItem> =>
        call("Risks", "GetRisk", { riskId }),

    create: (projectId: string, input: RiskInput): Promise<RiskItem> =>
        call("Risks", "CreateRisk", { projectId, ...input }),

    update: (riskId: string, input: RiskInput): Promise<RiskItem> =>
        call("Risks", "UpdateRisk", { riskId, ...input }),

    remove: (riskId: string): Promise<any> =>
        call("Risks", "DeleteRisk", { riskId })
})

export default CreateRisksApi
