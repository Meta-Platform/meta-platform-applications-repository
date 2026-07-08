import { Caller } from "./client"

export interface AppStateEntry {
    key: string
    value: any
}

// SystemController: export/import de projeto/board e app-state (memória da GUI).
const CreateSystemApi = (call: Caller) => ({
    // Export/Import — dump JSON no envelope { ok, data }.
    exportProject: (projectId: string): Promise<any> =>
        call("System", "ExportProject", { projectId }),

    exportBoard: (boardId: string): Promise<any> =>
        call("System", "ExportBoard", { boardId }),

    importProject: (data: any, actorUserId?: string): Promise<any> =>
        call("System", "ImportProject", { data, actorUserId }),

    // App-state (persistência no servidor de preferências da GUI).
    getAppState: (key: string): Promise<AppStateEntry | null> =>
        call("System", "GetAppState", { key }),

    setAppState: (key: string, value: any): Promise<AppStateEntry> =>
        call("System", "SetAppState", { key, value })
})

export default CreateSystemApi
