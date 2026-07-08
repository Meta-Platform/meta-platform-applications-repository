import { Caller } from "./client"
import { Milestone, Sprint, RoadmapEntry, HorizonBoard, WorkItem } from "./types"

export interface MilestoneInput {
    name?: string
    description?: string
    targetDate?: string
    status?: string
}

export interface SprintInput {
    name?: string
    goal?: string
    startDate?: string
    endDate?: string
    status?: string
}

// PlanningController: milestones, sprints, roadmap e atribuição a itens.
const CreatePlanningApi = (call: Caller) => ({
    // ---- Milestones ----
    listMilestones: (projectId: string): Promise<Milestone[]> =>
        call("Planning", "ListMilestones", { projectId }),

    createMilestone: (projectId: string, input: MilestoneInput & { name: string }): Promise<Milestone> =>
        call("Planning", "CreateMilestone", { projectId, ...input }),

    getMilestone: (milestoneId: string): Promise<Milestone> =>
        call("Planning", "GetMilestone", { milestoneId }),

    updateMilestone: (milestoneId: string, input: MilestoneInput): Promise<Milestone> =>
        call("Planning", "UpdateMilestone", { milestoneId, ...input }),

    deleteMilestone: (milestoneId: string): Promise<any> =>
        call("Planning", "DeleteMilestone", { milestoneId }),

    roadmap: (projectId: string): Promise<RoadmapEntry[]> =>
        call("Planning", "Roadmap", { projectId }),

    // Roadmap por horizonte: itens agrupados por horizon (inbox/now/next/later/maybe/archived/unassigned).
    roadmapByHorizon: (projectId: string): Promise<HorizonBoard> =>
        call("Planning", "RoadmapByHorizon", { projectId }),

    // ---- Sprints ----
    listSprints: (projectId: string): Promise<Sprint[]> =>
        call("Planning", "ListSprints", { projectId }),

    createSprint: (projectId: string, input: SprintInput & { name: string }): Promise<Sprint> =>
        call("Planning", "CreateSprint", { projectId, ...input }),

    getSprint: (sprintId: string): Promise<Sprint> =>
        call("Planning", "GetSprint", { sprintId }),

    updateSprint: (sprintId: string, input: SprintInput): Promise<Sprint> =>
        call("Planning", "UpdateSprint", { sprintId, ...input }),

    deleteSprint: (sprintId: string): Promise<any> =>
        call("Planning", "DeleteSprint", { sprintId }),

    // ---- Atribuição ao item ----
    // Passe o id do milestone/sprint, ou a string "none" para limpar.
    assignItemPlanning: (itemId: string, input: { milestone?: string; sprint?: string }): Promise<WorkItem> =>
        call("Planning", "AssignItemPlanning", { itemId, ...input })
})

export default CreatePlanningApi
