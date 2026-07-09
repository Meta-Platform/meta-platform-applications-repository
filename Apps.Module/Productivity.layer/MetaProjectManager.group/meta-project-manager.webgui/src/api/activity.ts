import { Caller } from "./client"
import { ActivityEntry, ActivityNote, ActivityFilters } from "./types"

export interface AddActivityNoteInput {
    text: string
    project?: string
    board?: string
    sprint?: string
    milestone?: string
    item?: string
}

// Auditoria (eventos imutáveis) + anotações de atividade (humanas/desktop).
const CreateActivityApi = (call: Caller) => ({
    listAudit: (filters: ActivityFilters = {}): Promise<ActivityEntry[]> =>
        call("Reports", "ListAuditEvents", filters),

    getAuditEvent: (eventId: string): Promise<ActivityEntry> =>
        call("Reports", "GetAuditEvent", { eventId }),

    listNotes: (scope: { project?: string; board?: string; sprint?: string; milestone?: string; item?: string; limit?: string } = {}): Promise<ActivityNote[]> =>
        call("Reports", "ListActivityNotes", scope),

    addNote: (input: AddActivityNoteInput): Promise<ActivityNote> =>
        call("Reports", "AddActivityNote", input),

    deleteNote: (noteId: string): Promise<{ id: string; deleted: boolean }> =>
        call("Reports", "DeleteActivityNote", { noteId })
})

export default CreateActivityApi
