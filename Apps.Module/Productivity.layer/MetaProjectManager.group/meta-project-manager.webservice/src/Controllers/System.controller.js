const { GetContext } = require("../AppContext")
const { Guard, idOf } = require("../Utils/respond")

// Controller System — export/import de projeto/board e app-state (memória da GUI).
const SystemController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ExportProject = async (arg) => Guard(async () => { await ctx.ready; return store.ExportProject({ project: idOf(arg, "projectId") }) })
    const ExportBoard   = async (arg) => Guard(async () => { await ctx.ready; return store.ExportBoard({ board: idOf(arg, "boardId") }) })
    const ImportProject = async (p = {}) => Guard(async () => { await ctx.ready; return store.ImportProject({ data: p.data, actor: { source: "api" } }) })

    const GetAppState = async (arg) => Guard(async () => { await ctx.ready; const value = await store.GetAppState({ key: idOf(arg, "key") }); return { key: idOf(arg, "key"), value: value === undefined ? null : value } })
    const SetAppState = async (p = {}) => Guard(async () => { await ctx.ready; return store.SetAppState({ key: p.key, value: p.value }) })

    return {
        controllerName: "SystemController",
        ExportProject, ExportBoard, ImportProject,
        GetAppState, SetAppState
    }
}

module.exports = SystemController
