const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Reports — adaptador HTTP fino sobre @/project-store.lib.
const ReportsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    // Auditoria/atividade com filtros completos. `actor` do webservice é humano
    // (source api) — a trava de consulta global só se aplica a agentes.
    const _activityFilters = (p) => ({
        entityType: p.entityType, entityId: p.entityId, action: p.action,
        actorUserId: p.actor, actorType: p.actorType, source: p.source,
        provider: p.provider, model: p.model, sessionId: p.session,
        from: p.from, to: p.to, limit: p.limit, offset: p.offset,
        actor: Actor(p)
    })

    const ListActivity = async (p = {}) => Guard(async () => {
        await ctx.ready
        const projectId = p.project && !p.allProjects ? (await store.ResolveProject(p.project)).id : undefined
        return store.ListActivity({ projectId, ..._activityFilters(p) })
    })

    const ListAuditEvents = async (p = {}) => Guard(async () => {
        await ctx.ready
        const projectId = p.project ? (await store.ResolveProject(p.project)).id : undefined
        return store.ListActivity({ projectId, ..._activityFilters(p) })
    })

    const GetAuditEvent = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "eventId"); return store.GetAuditEvent({ event: id }) })

    // Anotações de atividade (usuario-desktop por padrão quando não há autor humano).
    const ListActivityNotes = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListActivityNotes({ project: p.project, board: p.board, sprint: p.sprint, milestone: p.milestone, item: p.item, from: p.from, to: p.to, limit: p.limit, offset: p.offset, actor: Actor(p) }) })
    const AddActivityNote = async (p = {}) => Guard(async () => { await ctx.ready; return store.AddActivityNote({ project: p.project, board: p.board, sprint: p.sprint, milestone: p.milestone, item: p.item, text: p.text, source: "gui", actor: Actor(p) }) })
    const DeleteActivityNote = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "noteId"); return store.DeleteActivityNote({ note: id, actor: { source: "api" } }) })

    const ReportProjectStatus = async (p = {}) => Guard(async () => { await ctx.ready; return store.ProjectStatus({ project: p.project }) })
    const ReportBlocked = async (p = {}) => Guard(async () => { await ctx.ready; return store.Blocked({ project: p.project }) })
    const ReportOverdue = async (p = {}) => Guard(async () => { await ctx.ready; return store.Overdue({ project: p.project }) })
    const ReportByAssignee = async (p = {}) => Guard(async () => { await ctx.ready; return store.ByAssignee({ project: p.project }) })
    const ReportByAgent = async (p = {}) => Guard(async () => { await ctx.ready; return store.ByAgent({ project: p.project }) })

    return {
        controllerName: "ReportsController",
        ListActivity,
        ListAuditEvents,
        GetAuditEvent,
        ListActivityNotes,
        AddActivityNote,
        DeleteActivityNote,
        ReportProjectStatus,
        ReportBlocked,
        ReportOverdue,
        ReportByAssignee,
        ReportByAgent
    }
}

module.exports = ReportsController
