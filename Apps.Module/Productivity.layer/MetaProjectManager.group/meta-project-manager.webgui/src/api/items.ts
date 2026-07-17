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
    // Cronograma: datas e estimativa (null limpa o campo). Strings no fio; o
    // servidor coage para DATE/FLOAT/INTEGER.
    startDate?: string | null
    dueDate?: string | null
    estimatePoints?: string | null
    estimateMinutes?: string | null
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

// Contexto de software (achatado no item) — editável via UpdateItem.
export interface SoftwareContextFields {
    repositoryUrl?: string
    branchName?: string
    commitHash?: string
    pullRequestUrl?: string
    releaseTag?: string
    releaseUrl?: string
    environment?: string
    packagePath?: string
    moduleName?: string
    layerName?: string
    groupName?: string
}

export interface UpdateItemInput extends ItemPlanningFields, SoftwareContextFields {
    title?: string
    type?: string
    description?: string
    status?: string
    priority?: string
    progress?: string
    assignee?: string
    // Campos específicos do tipo (merge no servidor).
    typeFields?: { [key: string]: any }
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
    // Só os itens que tocam este pacote do ecossistema (ref|namespace|nome).
    package?: string
    sort?: string   // order | created | priority | value
}

const CreateItemsApi = (call: Caller) => ({
    list: (projectId: string, query: ListItemsQuery = {}): Promise<WorkItem[]> =>
        call("Items", "ListItems", { projectId, ...query }),

    create: (projectId: string, input: CreateItemInput): Promise<WorkItem> =>
        call("Items", "CreateItem", { projectId, ...input }),

    // Busca por título OU key, em todos os projetos (ou num só).
    search: (text: string, project?: string, limit = 25): Promise<WorkItem[]> =>
        call("Items", "SearchItems", { text, project, limit: String(limit) }),

    get: (itemId: string): Promise<WorkItem> =>
        call("Items", "GetItem", { itemId }),

    update: (itemId: string, input: UpdateItemInput): Promise<WorkItem> =>
        call("Items", "UpdateItem", { itemId, ...input }),

    move: (itemId: string, input: MoveItemInput): Promise<WorkItem> =>
        call("Items", "MoveItem", { itemId, ...input }),

    setStatus: (itemId: string, status: string): Promise<WorkItem> =>
        call("Items", "SetItemStatus", { itemId, status }),

    // Converte uma ideia em item de trabalho preservando a ideia (vínculo originated_from).
    convertIdea: (itemId: string, type: string, input: { title?: string; parent?: string } = {}): Promise<{ created: WorkItem; idea: WorkItem }> =>
        call("Items", "ConvertIdea", { itemId, type, ...input }),

    link: (itemId: string, relation: string, target: string): Promise<any> =>
        call("Items", "LinkItem", { itemId, relation, target }),

    unlink: (itemId: string, relation: string, target: string): Promise<any> =>
        call("Items", "UnlinkItem", { itemId, relation, target }),

    reorder: (itemId: string, order: number | string): Promise<any> =>
        call("Items", "ReorderItem", { itemId, order: String(order) }),

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
