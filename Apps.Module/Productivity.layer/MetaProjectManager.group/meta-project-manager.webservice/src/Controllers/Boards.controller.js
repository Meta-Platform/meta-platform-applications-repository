const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Boards — adaptador HTTP fino sobre @/project-store.lib.
const BoardsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListBoards = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "projectId"); return store.ListBoards({ project: id }) })
    const CreateBoard = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateBoard({ project: p.projectId, name: p.name, description: p.description, type: p.type, setDefault: p.default, actor: Actor(p) }) })
    const GetBoard = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "boardId"); return store.GetBoard({ board: id }) })
    const UpdateBoard = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateBoard({ board: p.boardId, name: p.name, description: p.description, type: p.type, actor: Actor(p) }) })
    const DeleteBoard = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "boardId"); return store.DeleteBoard({ board: id, actor: { source: "api" } }) })
    const AddColumn = async (p = {}) => Guard(async () => { await ctx.ready; return store.AddColumn({ board: p.boardId, name: p.name, statusKey: p.statusKey, color: p.color, wipLimit: p.wipLimit, isDoneColumn: p.isDoneColumn, actor: Actor(p) }) })
    const UpdateColumn = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateColumn({ column: p.columnId, name: p.name, statusKey: p.statusKey, color: p.color, wipLimit: p.wipLimit, isDoneColumn: p.isDoneColumn, actor: Actor(p) }) })
    const DeleteColumn = async (p = {}) => Guard(async () => { await ctx.ready; return store.DeleteColumn({ column: p.columnId, actor: Actor(p) }) })

    return {
        controllerName: "BoardsController",
        ListBoards,
        CreateBoard,
        GetBoard,
        UpdateBoard,
        DeleteBoard,
        AddColumn,
        UpdateColumn,
        DeleteColumn
    }
}

module.exports = BoardsController
