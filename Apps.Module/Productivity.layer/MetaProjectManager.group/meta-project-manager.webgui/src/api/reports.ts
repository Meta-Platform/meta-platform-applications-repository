import { Caller } from "./client"
import { ActivityEntry, ExecutionOverview, FlowReport, ItemTimelineReport, ProjectPulse, SequenceReport, WorkItem } from "./types"

const CreateReportsApi = (call: Caller) => ({
    activity: (query: { project?: string; limit?: string } = {}): Promise<ActivityEntry[]> =>
        call("Reports", "ListActivity", query),

    // Fluxo temporal (CFD + throughput) reconstruído do audit log.
    flow: (project?: string): Promise<FlowReport> =>
        call("Reports", "ReportFlow", { project }),

    // "Em que pé está agora": rodada corrente + em execução, fila, concluído e bloqueado.
    execution: (project?: string, queueLimit?: number): Promise<ExecutionOverview> =>
        call("Reports", "ReportExecution", { project, queueLimit }),

    // Início/fim REAIS por item, reconstruídos da auditoria (não de datas digitadas).
    itemTimeline: (project?: string): Promise<ItemTimelineReport> =>
        call("Reports", "ReportItemTimeline", { project }),

    // Sequência: estado por item, de quem espera e o que destrava (sem datas).
    sequence: (project?: string): Promise<SequenceReport> =>
        call("Reports", "ReportSequence", { project }),

    // O que acabou de acontecer: status, criação, bloqueio, reivindicação e o
    // que os agentes reportaram — em ordem.
    pulse: (project?: string, limit?: number): Promise<ProjectPulse> =>
        call("Reports", "ReportPulse", { project, limit }),

    // Fila: o que está pronto para pegar, ordenado pelo que mais destrava.
    ready: (project?: string, limit?: number): Promise<WorkItem[]> =>
        call("Reports", "ReportReady", { project, limit }),

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
