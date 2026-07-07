const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Items — adaptador HTTP fino sobre @/project-store.lib.
const ItemsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListItems = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListItems({ project: p.projectId, type: p.type, status: p.status, parent: p.parent, board: p.board, assignee: p.assignee, priority: p.priority, text: p.text, limit: p.limit, offset: p.offset, sort: p.sort }) })
    const CreateItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateItem({ project: p.projectId, type: p.type, title: p.title, description: p.description, parent: p.parent, board: p.board, priority: p.priority, statusKey: p.status, assignee: p.assignee, reporter: p.reporter, dueDate: p.dueDate, labels: p.labels, actor: Actor(p) }) })
    const GetItem = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "itemId"); return store.GetItem({ item: id }) })
    const UpdateItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateItem({ item: p.itemId, title: p.title, description: p.description, statusKey: p.status, priority: p.priority, progress: p.progress, dueDate: p.dueDate, assignee: p.assignee, labels: p.labels, blockedReason: p.blockedReason, actor: Actor(p) }) })
    const MoveItem = async (p = {}) => Guard(async () => { await ctx.ready; return p.board ? store.MoveToBoard({ item: p.itemId, board: p.board, status: p.status, actor: Actor(p) }) : store.MoveItem({ item: p.itemId, parent: p.parent, actor: Actor(p) }) })
    const SetItemStatus = async (p = {}) => Guard(async () => { await ctx.ready; return store.SetStatus({ item: p.itemId, status: p.status, actor: Actor(p) }) })
    const LinkItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.LinkItem({ item: p.itemId, relation: p.relation, target: p.target, actor: Actor(p) }) })
    const DeleteItem = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "itemId"); return store.DeleteItem({ item: id, actor: { source: "api" } }) })

    return {
        controllerName: "ItemsController",
        ListItems,
        CreateItem,
        GetItem,
        UpdateItem,
        MoveItem,
        SetItemStatus,
        LinkItem,
        DeleteItem
    }
}

module.exports = ItemsController
