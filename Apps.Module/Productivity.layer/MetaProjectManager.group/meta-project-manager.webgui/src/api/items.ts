import { Caller } from "./client"
import { WorkItem } from "./types"

// Campos de planejamento/priorização aceitos em create/update.
export interface ItemPlanningFields {
    milestoneId?: string
    sprintId?: string
    horizon?: string
    clarityState?: string
    effort?: string
    value?: string
    area?: string
    ideaOrigin?: string
}

export interface CreateItemInput extends ItemPlanningFields {
    title: string
    type?: string
    description?: string
    parent?: string
    board?: string
    priority?: string
    status?: string
    assignee?: string
}

export interface UpdateItemInput extends ItemPlanningFields {
    title?: string
    type?: string
    description?: string
    status?: string
    priority?: string
    progress?: string
    assignee?: string
}

export interface MoveItemInput {
    parent?: string
    board?: string
    status?: string
}

// Filtros suportados pelo ListItems (Fase 2).
export interface ListItemsQuery {
    type?: string
    status?: string
    priority?: string
    assignee?: string
    text?: string
    milestone?: string
    sprint?: string
    horizon?: string
    clarityState?: string
    effort?: string
    value?: string
    area?: string
    sort?: string   // order | created | priority | value
}

const CreateItemsApi = (call: Caller) => ({
    list: (projectId: string, query: ListItemsQuery = {}): Promise<WorkItem[]> =>
        call("Items", "ListItems", { projectId, ...query }),

    create: (projectId: string, input: CreateItemInput): Promise<WorkItem> =>
        call("Items", "CreateItem", { projectId, ...input }),

    get: (itemId: string): Promise<WorkItem> =>
        call("Items", "GetItem", { itemId }),

    update: (itemId: string, input: UpdateItemInput): Promise<WorkItem> =>
        call("Items", "UpdateItem", { itemId, ...input }),

    move: (itemId: string, input: MoveItemInput): Promise<WorkItem> =>
        call("Items", "MoveItem", { itemId, ...input }),

    setStatus: (itemId: string, status: string): Promise<WorkItem> =>
        call("Items", "SetItemStatus", { itemId, status }),

    link: (itemId: string, relation: string, target: string): Promise<any> =>
        call("Items", "LinkItem", { itemId, relation, target }),

    remove: (itemId: string): Promise<any> =>
        call("Items", "DeleteItem", { itemId }),

    // Checklist — GetItem devolve checklist[] atualizado após cada mutação.
    addChecklistItem: (itemId: string, text: string): Promise<any> =>
        call("Items", "AddChecklistItem", { itemId, text }),

    updateChecklistItem: (checklistItemId: string, input: { text?: string; done?: boolean }): Promise<any> =>
        call("Items", "UpdateChecklistItem", { checklistItemId, ...input }),

    removeChecklistItem: (checklistItemId: string): Promise<any> =>
        call("Items", "RemoveChecklistItem", { checklistItemId }),

    // Critérios de aceite — GetItem devolve acceptanceCriteria[] após cada mutação.
    addAcceptanceCriteria: (itemId: string, text: string): Promise<any> =>
        call("Items", "AddAcceptanceCriteria", { itemId, text }),

    updateAcceptanceCriteria: (criteriaId: string, input: { text?: string; met?: boolean }): Promise<any> =>
        call("Items", "UpdateAcceptanceCriteria", { criteriaId, ...input }),

    removeAcceptanceCriteria: (criteriaId: string): Promise<any> =>
        call("Items", "RemoveAcceptanceCriteria", { criteriaId })
})

export default CreateItemsApi
