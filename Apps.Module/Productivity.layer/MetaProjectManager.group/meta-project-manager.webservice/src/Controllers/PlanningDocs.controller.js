const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller PlanningDocs — documento de planejamento (termo de abertura/charter
// com seções estruturadas) sobre @/project-store.lib. Adaptador HTTP fino.
// Escrita em projeto arquivado é recusada pela lib (PROJECT_ARCHIVED).
const PlanningDocsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    // Seções de conteúdo repassadas ao store em create/update.
    const _sections = (p) => ({
        objective: p.objective, scope: p.scope, outOfScope: p.outOfScope, stakeholders: p.stakeholders,
        assumptions: p.assumptions, constraints: p.constraints, successCriteria: p.successCriteria, deliverables: p.deliverables
    })

    const ListPlanningDocs = async (arg) => Guard(async () => { await ctx.ready; return store.ListPlanningDocs({ project: idOf(arg, "projectId") }) })
    const CreatePlanningDoc = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreatePlanningDoc({ project: p.projectId, title: p.title, milestoneId: p.milestoneId, status: p.status, ..._sections(p), actor: Actor(p) }) })
    const GetPlanningDoc = async (arg) => Guard(async () => { await ctx.ready; return store.GetPlanningDoc({ planningDoc: idOf(arg, "planningDocId") }) })
    const UpdatePlanningDoc = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdatePlanningDoc({ planningDoc: p.planningDocId, title: p.title, milestoneId: p.milestoneId, status: p.status, ..._sections(p), actor: Actor(p) }) })
    const DeletePlanningDoc = async (arg) => Guard(async () => { await ctx.ready; return store.DeletePlanningDoc({ planningDoc: idOf(arg, "planningDocId"), actor: { source: "api" } }) })

    return {
        controllerName: "PlanningDocsController",
        ListPlanningDocs, CreatePlanningDoc, GetPlanningDoc, UpdatePlanningDoc, DeletePlanningDoc
    }
}

module.exports = PlanningDocsController
