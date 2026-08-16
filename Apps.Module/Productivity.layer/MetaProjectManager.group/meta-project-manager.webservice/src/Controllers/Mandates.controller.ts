const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Mandates — o escopo que o humano concede ao agente, com as
// condições de parada, e os papéis (executor/revisor/planejador).
const MandatesController = (params: any) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListMandates = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.ListMandates({ project: p.projectId, status: p.status }) })
    const CreateMandate = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.CreateMandate({
        project: p.projectId, title: p.title, shortDescription: p.shortDescription, scope: p.scope,
        agent: p.agent, session: p.session, expiresAt: p.expiresAt,
        maxDeliveries: p.maxDeliveries, maxUnreviewedDeliveries: p.maxUnreviewedDeliveries,
        maxConsecutiveReturns: p.maxConsecutiveReturns, stopOnOutOfScope: p.stopOnOutOfScope,
        actor: Actor(p)
    }) })
    const GetMandate = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.GetMandate({ mandate: idOf(p, "mandateId") }) })
    const ExtendMandate = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.ExtendMandate({ mandate: p.mandateId, maxDeliveries: p.maxDeliveries, maxUnreviewedDeliveries: p.maxUnreviewedDeliveries, maxConsecutiveReturns: p.maxConsecutiveReturns, expiresAt: p.expiresAt, note: p.note, actor: Actor(p) }) })
    const RevokeMandate = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.RevokeMandate({ mandate: p.mandateId, reason: p.reason, actor: Actor(p) }) })

    const ListRoles = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.ListRoles({ project: p.project, role: p.role }) })
    const GrantRole = async (p: any = {}) => Guard(async () => { await ctx.ready; return store.GrantRole({ agent: p.agent, session: p.session, role: p.role, project: p.project, note: p.note, actor: Actor(p) }) })
    const RevokeRole = async (p = {}) => Guard(async () => { await ctx.ready; return store.RevokeRole({ assignment: idOf(p, "assignmentId"), actor: Actor(p) }) })

    return {
        controllerName: "MandatesController",
        ListMandates, CreateMandate, GetMandate, ExtendMandate, RevokeMandate,
        ListRoles, GrantRole, RevokeRole
    }
}

module.exports = MandatesController
