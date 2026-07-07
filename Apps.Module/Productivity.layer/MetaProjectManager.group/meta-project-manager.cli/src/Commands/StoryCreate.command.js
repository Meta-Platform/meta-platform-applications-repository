const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateItem({ project: args.project, type: "story", title: args.title, description: args.description, parent: args.parent, board: args.board, priority: args.priority, statusKey: args.status, assignee: args.assignee, actor })
})
