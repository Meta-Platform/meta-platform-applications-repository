import { Caller } from "./client"
import { ActivityEntry, FlowReport } from "./types"

const CreateReportsApi = (call: Caller) => ({
    activity: (query: { project?: string; limit?: string } = {}): Promise<ActivityEntry[]> =>
        call("Reports", "ListActivity", query),

    // Fluxo temporal (CFD + throughput) reconstruído do audit log.
    flow: (project?: string): Promise<FlowReport> =>
        call("Reports", "ReportFlow", { project }),

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
