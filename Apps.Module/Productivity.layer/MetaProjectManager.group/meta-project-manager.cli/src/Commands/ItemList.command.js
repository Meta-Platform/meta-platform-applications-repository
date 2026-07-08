const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListItems({ project: args.project, type: args.type, status: args.status, parent: args.parent, board: args.board, assignee: args.assignee, priority: args.priority, milestone: args.milestone, sprint: args.sprint, horizon: args.horizon, clarityState: args.clarity, effort: args.effort, value: args.value, area: args.area, text: args.text, limit: args.limit, offset: args.offset, sort: args.sort })
})
