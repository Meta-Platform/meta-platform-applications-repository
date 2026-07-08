const { GetContext } = require("../AppContext")
const { Guard, idOf, Actor } = require("../Utils/respond")

// Controller Items — adaptador HTTP fino sobre @/project-store.lib.
const ItemsController = (params) => {
    const ctx = GetContext(params)
    const { store } = ctx

    const ListItems = async (p = {}) => Guard(async () => { await ctx.ready; return store.ListItems({ project: p.projectId, type: p.type, status: p.status, parent: p.parent, board: p.board, assignee: p.assignee, priority: p.priority, text: p.text, milestone: p.milestone, sprint: p.sprint, horizon: p.horizon, clarityState: p.clarityState, effort: p.effort, value: p.value, area: p.area, limit: p.limit, offset: p.offset, sort: p.sort }) })
    const CreateItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.CreateItem({ project: p.projectId, type: p.type, title: p.title, description: p.description, parent: p.parent, board: p.board, priority: p.priority, statusKey: p.status, assignee: p.assignee, reporter: p.reporter, dueDate: p.dueDate, labels: p.labels, milestoneId: p.milestoneId, sprintId: p.sprintId, horizon: p.horizon, clarityState: p.clarityState, effort: p.effort, value: p.value, area: p.area, ideaOrigin: p.ideaOrigin, actor: Actor(p) }) })
    const GetItem = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "itemId"); return store.GetItem({ item: id }) })
    const UpdateItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateItem({ item: p.itemId, title: p.title, description: p.description, statusKey: p.status, priority: p.priority, progress: p.progress, dueDate: p.dueDate, assignee: p.assignee, labels: p.labels, blockedReason: p.blockedReason, milestoneId: p.milestoneId, sprintId: p.sprintId, horizon: p.horizon, clarityState: p.clarityState, effort: p.effort, value: p.value, area: p.area, ideaOrigin: p.ideaOrigin, repositoryUrl: p.repositoryUrl, branchName: p.branchName, commitHash: p.commitHash, pullRequestUrl: p.pullRequestUrl, environment: p.environment, packagePath: p.packagePath, moduleName: p.moduleName, layerName: p.layerName, groupName: p.groupName, actor: Actor(p) }) })
    const MoveItem = async (p = {}) => Guard(async () => { await ctx.ready; return p.board ? store.MoveToBoard({ item: p.itemId, board: p.board, status: p.status, actor: Actor(p) }) : store.MoveItem({ item: p.itemId, parent: p.parent, actor: Actor(p) }) })
    const SetItemStatus = async (p = {}) => Guard(async () => { await ctx.ready; return store.SetStatus({ item: p.itemId, status: p.status, actor: Actor(p) }) })
    const LinkItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.LinkItem({ item: p.itemId, relation: p.relation, target: p.target, actor: Actor(p) }) })
    const UnlinkItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.UnlinkItem({ item: p.itemId, relation: p.relation, target: p.target, actor: Actor(p) }) })
    const ReorderItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.ReorderItem({ item: p.itemId, order: p.order, actor: Actor(p) }) })
    const DeleteItem = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "itemId"); return store.DeleteItem({ item: id, actor: { source: "api" } }) })

    // Checklist
    const AddChecklistItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.AddChecklistItem({ item: p.itemId, text: p.text, actor: Actor(p) }) })
    const UpdateChecklistItem = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateChecklistItem({ checklistItem: p.checklistItemId, text: p.text, done: p.done }) })
    const RemoveChecklistItem = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "checklistItemId"); return store.RemoveChecklistItem({ checklistItem: id }) })

    // Critérios de aceite
    const AddAcceptanceCriteria = async (p = {}) => Guard(async () => { await ctx.ready; return store.AddAcceptanceCriteria({ item: p.itemId, text: p.text }) })
    const UpdateAcceptanceCriteria = async (p = {}) => Guard(async () => { await ctx.ready; return store.UpdateAcceptanceCriteria({ criteria: p.criteriaId, text: p.text, met: p.met }) })
    const RemoveAcceptanceCriteria = async (arg) => Guard(async () => { await ctx.ready; const id = idOf(arg, "criteriaId"); return store.RemoveAcceptanceCriteria({ criteria: id }) })

    return {
        controllerName: "ItemsController",
        ListItems,
        CreateItem,
        GetItem,
        UpdateItem,
        MoveItem,
        SetItemStatus,
        LinkItem,
        UnlinkItem,
        ReorderItem,
        DeleteItem,
        AddChecklistItem,
        UpdateChecklistItem,
        RemoveChecklistItem,
        AddAcceptanceCriteria,
        UpdateAcceptanceCriteria,
        RemoveAcceptanceCriteria
    }
}

module.exports = ItemsController
