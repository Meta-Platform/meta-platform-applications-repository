import { Caller } from "./client"
import { WorkItem } from "./types"

export interface CreateItemInput {
    title: string
    type?: string
    description?: string
    parent?: string
    board?: string
    priority?: string
    status?: string
    assignee?: string
}

export interface UpdateItemInput {
    title?: string
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

const CreateItemsApi = (call: Caller) => ({
    list: (projectId: string, query: { type?: string; status?: string } = {}): Promise<WorkItem[]> =>
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
        call("Items", "DeleteItem", { itemId })
})

export default CreateItemsApi
