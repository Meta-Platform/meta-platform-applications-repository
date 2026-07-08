const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Planning — milestones, sprints e roadmap sobre @/project-store.lib.
// Criar milestone/sprint por agente (Actor inline) dispara o gate de criação.
const PlanningController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    // Milestones
    const ListMilestones = async (arg) => Guard(async () => { await ctx.ready; return store.ListMilestones({ project: idOf(arg, "projectId") }) })
    const CreateMilestone = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateMilestone({ project: p.projectId, name: p.name, description: p.description, targetDate: p.targetDate, status: p.status, actor: Actor(p) }) })
    const GetMilestone = async (arg) => Guard(async () => { await ctx.ready; return store.GetMilestone({ milestone: idOf(arg, "milestoneId") }) })
    const UpdateMilestone = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateMilestone({ milestone: p.milestoneId, name: p.name, description: p.description, targetDate: p.targetDate, status: p.status, actor: Actor(p) }) })
    const DeleteMilestone = async (arg) => Guard(async () => { await ctx.ready; return store.DeleteMilestone({ milestone: idOf(arg, "milestoneId"), actor: { source: "api" } }) })
    const Roadmap = async (arg) => Guard(async () => { await ctx.ready; return store.Roadmap({ project: idOf(arg, "projectId") }) })
    const RoadmapByHorizon = async (arg) => Guard(async () => { await ctx.ready; return store.RoadmapByHorizon({ project: idOf(arg, "projectId") }) })

    // Sprints
    const ListSprints = async (arg) => Guard(async () => { await ctx.ready; return store.ListSprints({ project: idOf(arg, "projectId") }) })
    const CreateSprint = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateSprint({ project: p.projectId, name: p.name, goal: p.goal, startDate: p.startDate, endDate: p.endDate, status: p.status, actor: Actor(p) }) })
    const GetSprint = async (arg) => Guard(async () => { await ctx.ready; return store.GetSprint({ sprint: idOf(arg, "sprintId") }) })
    const UpdateSprint = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateSprint({ sprint: p.sprintId, name: p.name, goal: p.goal, startDate: p.startDate, endDate: p.endDate, status: p.status, actor: Actor(p) }) })
    const DeleteSprint = async (arg) => Guard(async () => { await ctx.ready; return store.DeleteSprint({ sprint: idOf(arg, "sprintId"), actor: { source: "api" } }) })

    // Atribuição de milestone/sprint a um item.
    const AssignItemPlanning = async (p = {}) => Guard(async () => { await ctx.ready; return store.AssignItemPlanning({ item: p.itemId, milestone: p.milestone, sprint: p.sprint, actor: Actor(p) }) })

    return {
        controllerName: "PlanningController",
        ListMilestones, CreateMilestone, GetMilestone, UpdateMilestone, DeleteMilestone, Roadmap, RoadmapByHorizon,
        ListSprints, CreateSprint, GetSprint, UpdateSprint, DeleteSprint,
        AssignItemPlanning
    }
}

module.exports = PlanningController
