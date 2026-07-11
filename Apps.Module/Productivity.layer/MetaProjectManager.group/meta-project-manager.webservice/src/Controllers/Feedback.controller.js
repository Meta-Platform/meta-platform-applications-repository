const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Feedback — adaptador HTTP fino sobre @/project-store.lib.
// O humano cria feedback pela GUI; os agentes pegam (claim) e resolvem pelo MCP.
const FeedbackController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.ListFeedback({
            project: p.project, status: p.status, item: p.item,
            entityType: p.entityType, entityId: p.entityId,
            since: p.since, until: p.until, limit: p.limit, offset: p.offset
        })
    })

    const GetFeedback = async (arg) => Guard(async () => {
        await ctx.ready
        return store.GetFeedback({ feedback: idOf(arg, "feedbackId") })
    })

    const CreateFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.CreateFeedback({
            project: p.project, item: p.item,
            entityType: p.entityType, entityId: p.entityId,
            field: p.field, fieldLabel: p.fieldLabel,
            screen: p.screen, excerpt: p.excerpt, body: p.body,
            source: p.source || "gui", actor: Actor(p)
        })
    })

    const ClaimFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.ClaimFeedback({ feedback: p.feedbackId, ttlSeconds: p.ttlSeconds, actor: Actor(p) })
    })

    const ReleaseFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.ReleaseFeedback({ feedback: p.feedbackId, actor: Actor(p) })
    })

    const ResolveFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.ResolveFeedback({ feedback: p.feedbackId, note: p.note, actor: Actor(p) })
    })

    const DismissFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.DismissFeedback({ feedback: p.feedbackId, reason: p.reason, actor: Actor(p) })
    })

    const ReopenFeedback = async (p = {}) => Guard(async () => {
        await ctx.ready
        return store.ReopenFeedback({ feedback: p.feedbackId, actor: Actor(p) })
    })

    return {
        controllerName: "FeedbackController",
        ListFeedback,
        GetFeedback,
        CreateFeedback,
        ClaimFeedback,
        ReleaseFeedback,
        ResolveFeedback,
        DismissFeedback,
        ReopenFeedback
    }
}

module.exports = FeedbackController
