import { Caller } from "./client"
import { PlanningDoc } from "./types"

// Seções + metadados aceitos em create/update. "none" em milestoneId desvincula.
export interface PlanningDocInput {
    title?: string
    milestoneId?: string | null
    status?: string
    objective?: string
    scope?: string
    outOfScope?: string
    stakeholders?: string
    assumptions?: string
    constraints?: string
    successCriteria?: string
    deliverables?: string
}

// Documento de planejamento (termo de abertura/charter). Métodos de escrita
// começam com Create/Update/Delete → o guard de projeto arquivado (client.ts) os
// bloqueia automaticamente.
const CreatePlanningDocsApi = (call: Caller) => ({
    list: (projectId: string): Promise<PlanningDoc[]> =>
        call("PlanningDocs", "ListPlanningDocs", { projectId }),

    get: (planningDocId: string): Promise<PlanningDoc> =>
        call("PlanningDocs", "GetPlanningDoc", { planningDocId }),

    create: (projectId: string, input: PlanningDocInput): Promise<PlanningDoc> =>
        call("PlanningDocs", "CreatePlanningDoc", { projectId, ...input }),

    update: (planningDocId: string, input: PlanningDocInput): Promise<PlanningDoc> =>
        call("PlanningDocs", "UpdatePlanningDoc", { planningDocId, ...input }),

    remove: (planningDocId: string): Promise<any> =>
        call("PlanningDocs", "DeletePlanningDoc", { planningDocId })
})

export default CreatePlanningDocsApi
