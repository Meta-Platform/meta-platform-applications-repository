const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Projects — adaptador HTTP fino sobre @/project-store.lib.
const ProjectsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListProjects = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListProjects({ status: p.status, sort: p.sort, limit: p.limit, offset: p.offset, includeArchived: p.all }) })
    const CreateProject = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateProject({ ...p, ownerUserId: p.owner, actor: Actor(p) }) })
    const GetProject = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "projectId"); return store.GetProject({ project: id }) })
    const UpdateProject = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateProject({ project: p.projectId, ...p, ownerUserId: p.owner, actor: Actor(p) }) })
    const ArchiveProject = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "projectId"); return store.ArchiveProject({ project: id, actor: { source: "api" } }) })
    const RestoreProject = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "projectId"); return store.RestoreProject({ project: id, actor: { source: "api" } }) })
    const DeleteProject = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "projectId"); return store.DeleteProject({ project: id, actor: { source: "api" } }) })
    const ProjectMetrics = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "projectId"); return store.ProjectMetrics({ project: id }) })

    return {
        controllerName: "ProjectsController",
        ListProjects,
        CreateProject,
        GetProject,
        UpdateProject,
        ArchiveProject,
        RestoreProject,
        DeleteProject,
        ProjectMetrics
    }
}

module.exports = ProjectsController
