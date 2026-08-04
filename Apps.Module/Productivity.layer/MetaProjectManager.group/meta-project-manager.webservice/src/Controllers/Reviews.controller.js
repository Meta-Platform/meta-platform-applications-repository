const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Reviews — a MESA DE REVISÃO e as decisões sobre entregas.
// `ReviewDesk` é a chamada que responde "o que espera por mim agora": ela
// existe para que a tela inicial não precise recombinar quatro consultas.
const ReviewsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ReviewDesk = async (p = {}) => Guard(async () => { await ctx.ready; return store.ReviewDesk({ project: p.project, limit: p.limit }) })
    const ListPendingReviews = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListPendingAiReviews({ project: p.projectId, limit: p.limit }) })
    const ListDeliveryReviews = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListDeliveryReviews({ delivery: idOf(p, "deliveryId") }) })
    const SubmitReview = async (p = {}) => Guard(async () => { await ctx.ready; return store.SubmitReview({ delivery: p.deliveryId, decision: p.decision, reason: p.reason, criteriaVerdict: p.criteriaVerdict, actor: Actor(p) }) })
    const EscalateToHuman = async (p = {}) => Guard(async () => { await ctx.ready; return store.EscalateToHuman({ delivery: p.deliveryId, reason: p.reason, actor: Actor(p) }) })

    return {
        controllerName: "ReviewsController",
        ReviewDesk, ListPendingReviews, ListDeliveryReviews, SubmitReview, EscalateToHuman
    }
}

module.exports = ReviewsController
