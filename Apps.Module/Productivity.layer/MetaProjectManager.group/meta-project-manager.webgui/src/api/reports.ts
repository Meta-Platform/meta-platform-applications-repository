import { Caller } from "./client"
import { ActivityEntry } from "./types"

const CreateReportsApi = (call: Caller) => ({
    activity: (query: { project?: string; limit?: string } = {}): Promise<ActivityEntry[]> =>
        call("Reports", "ListActivity", query),

    projectStatus: (project?: string): Promise<any> =>
        call("Reports", "ReportProjectStatus", { project }),

    blocked: (project?: string): Promise<any> =>
        call("Reports", "ReportBlocked", { project }),

    overdue: (project?: string): Promise<any> =>
        call("Reports", "ReportOverdue", { project }),

    byAssignee: (project?: string): Promise<any> =>
        call("Reports", "ReportByAssignee", { project }),

    byAgent: (project?: string): Promise<any> =>
        call("Reports", "ReportByAgent", { project })
})

export default CreateReportsApi
