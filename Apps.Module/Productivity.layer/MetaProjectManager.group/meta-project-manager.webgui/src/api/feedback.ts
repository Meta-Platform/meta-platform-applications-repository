import { Caller } from "./client"
import { AgentFeedback, ListFeedbackQuery } from "./types"

// Feedback do humano para os agentes: criado na GUI (botão direito num campo),
// consumido pelos agentes via MCP (claim → resolve).
const CreateFeedbackApi = (call: Caller) => ({
    list: (query: ListFeedbackQuery = {}): Promise<AgentFeedback[]> =>
        call("Feedback", "ListFeedback", query),

    get: (feedbackId: string): Promise<AgentFeedback> =>
        call("Feedback", "GetFeedback", { feedbackId }),

    create: (input: {
        project?: string
        item?: string
        entityType?: string
        entityId?: string
        field?: string
        fieldLabel?: string
        screen?: string
        excerpt?: string
        body: string
    }): Promise<AgentFeedback> =>
        call("Feedback", "CreateFeedback", input),

    dismiss: (feedbackId: string, reason?: string): Promise<AgentFeedback> =>
        call("Feedback", "DismissFeedback", { feedbackId, reason }),

    reopen: (feedbackId: string): Promise<AgentFeedback> =>
        call("Feedback", "ReopenFeedback", { feedbackId }),

    release: (feedbackId: string): Promise<AgentFeedback> =>
        call("Feedback", "ReleaseFeedback", { feedbackId })
})

export default CreateFeedbackApi
