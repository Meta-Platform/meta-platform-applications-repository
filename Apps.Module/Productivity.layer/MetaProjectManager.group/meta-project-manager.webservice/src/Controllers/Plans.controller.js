const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Plans — o plano que o agente propõe e o humano aceita numa decisão
// só, mais a MIGRAÇÃO do projeto para o modelo de entrega (ação humana: é ela
// que muda como o agente é governado ali).
const PlansController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListPlans = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListPlans({ project: p.projectId, status: p.status }) })
    const GetPlan = async (p = {}) => Guard(async () => { await ctx.ready; return store.GetPlan({ plan: idOf(p, "planId") }) })
    const RevisePlan = async (p = {}) => Guard(async () => { await ctx.ready; return store.RevisePlan({ plan: p.planId, node: p.nodeId, updates: p.updates, actor: Actor(p) }) })
    const AcceptPlan = async (p = {}) => Guard(async () => { await ctx.ready; return store.AcceptPlan({ plan: p.planId, createSprint: p.createSprint, createMandate: p.createMandate, actor: Actor(p) }) })
    const RejectPlan = async (p = {}) => Guard(async () => { await ctx.ready; return store.RejectPlan({ plan: p.planId, reason: p.reason, actor: Actor(p) }) })

    const MigrateProject = async (p = {}) => Guard(async () => { await ctx.ready; return store.MigrateProjectToDeliveryModel({ project: p.projectId, actor: Actor(p) }) })
    const RollbackProject = async (p = {}) => Guard(async () => { await ctx.ready; return store.RollbackProjectToLegacy({ project: idOf(p, "projectId"), actor: Actor(p) }) })

    return {
        controllerName: "PlansController",
        ListPlans, GetPlan, RevisePlan, AcceptPlan, RejectPlan,
        MigrateProject, RollbackProject
    }
}

module.exports = PlansController
