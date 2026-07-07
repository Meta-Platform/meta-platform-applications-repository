import { Caller } from "./client"
import { Board } from "./types"

export interface CreateBoardInput {
    name: string
    description?: string
    type?: string
}

export interface AddColumnInput {
    name: string
    statusKey?: string
    color?: string
    wipLimit?: string
    isDoneColumn?: string
}

export interface UpdateColumnInput {
    name?: string
    statusKey?: string
    color?: string
    order?: string
}

const CreateBoardsApi = (call: Caller) => ({
    list: (projectId: string): Promise<Board[]> =>
        call("Boards", "ListBoards", { projectId }),

    create: (projectId: string, input: CreateBoardInput): Promise<Board> =>
        call("Boards", "CreateBoard", { projectId, ...input }),

    get: (boardId: string): Promise<Board> =>
        call("Boards", "GetBoard", { boardId }),

    update: (boardId: string, input: CreateBoardInput): Promise<Board> =>
        call("Boards", "UpdateBoard", { boardId, ...input }),

    remove: (boardId: string): Promise<any> =>
        call("Boards", "DeleteBoard", { boardId }),

    addColumn: (boardId: string, input: AddColumnInput): Promise<any> =>
        call("Boards", "AddColumn", { boardId, ...input }),

    updateColumn: (boardId: string, columnId: string, input: UpdateColumnInput): Promise<any> =>
        call("Boards", "UpdateColumn", { boardId, columnId, ...input }),

    deleteColumn: (boardId: string, columnId: string): Promise<any> =>
        call("Boards", "DeleteColumn", { boardId, columnId })
})

export default CreateBoardsApi
