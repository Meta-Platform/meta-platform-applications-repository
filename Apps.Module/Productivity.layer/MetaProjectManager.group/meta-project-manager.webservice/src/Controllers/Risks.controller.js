const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Risks — registro de riscos do projeto (matriz 3×3, mitigação,
// contingência, dono, marco) sobre @/project-store.lib. Adaptador HTTP fino.
// Escrita em projeto arquivado é recusada pela lib (PROJECT_ARCHIVED).
const RisksController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListRisks = async (arg) => Guard(async () => { await ctx.ready; return store.ListRisks({ project: idOf(arg, "projectId") }) })
    const CreateRisk = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateRisk({ project: p.projectId, title: p.title, description: p.description, probability: p.probability, impact: p.impact, status: p.status, category: p.category, mitigation: p.mitigation, contingency: p.contingency, ownerUserId: p.ownerUserId, milestoneId: p.milestoneId, actor: Actor(p) }) })
    const GetRisk = async (arg) => Guard(async () => { await ctx.ready; return store.GetRisk({ risk: idOf(arg, "riskId") }) })
    const UpdateRisk = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateRisk({ risk: p.riskId, title: p.title, description: p.description, probability: p.probability, impact: p.impact, status: p.status, category: p.category, mitigation: p.mitigation, contingency: p.contingency, ownerUserId: p.ownerUserId, milestoneId: p.milestoneId, actor: Actor(p) }) })
    const DeleteRisk = async (arg) => Guard(async () => { await ctx.ready; return store.DeleteRisk({ risk: idOf(arg, "riskId"), actor: { source: "api" } }) })

    return {
        controllerName: "RisksController",
        ListRisks, CreateRisk, GetRisk, UpdateRisk, DeleteRisk
    }
}

module.exports = RisksController
