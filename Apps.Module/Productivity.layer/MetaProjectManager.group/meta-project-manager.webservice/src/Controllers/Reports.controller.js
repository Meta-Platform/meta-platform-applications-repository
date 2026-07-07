const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Reports — adaptador HTTP fino sobre @/project-store.lib.
const ReportsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListActivity = async (p = {}) => Guard(async () => { await ctx.ready; const projectId = p.project ? (await store.ResolveProject(p.project)).id : undefined; return store.ListActivity({ projectId, limit: p.limit, offset: p.offset }) })
    const ReportProjectStatus = async (p = {}) => Guard(async () => { await ctx.ready; return store.ProjectStatus({ project: p.project }) })
    const ReportBlocked = async (p = {}) => Guard(async () => { await ctx.ready; return store.Blocked({ project: p.project }) })
    const ReportOverdue = async (p = {}) => Guard(async () => { await ctx.ready; return store.Overdue({ project: p.project }) })
    const ReportByAssignee = async (p = {}) => Guard(async () => { await ctx.ready; return store.ByAssignee({ project: p.project }) })
    const ReportByAgent = async (p = {}) => Guard(async () => { await ctx.ready; return store.ByAgent({ project: p.project }) })

    return {
        controllerName: "ReportsController",
        ListActivity,
        ReportProjectStatus,
        ReportBlocked,
        ReportOverdue,
        ReportByAssignee,
        ReportByAgent
    }
}

module.exports = ReportsController
