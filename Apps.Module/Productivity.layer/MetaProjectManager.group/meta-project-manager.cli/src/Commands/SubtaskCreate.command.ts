const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.CreateItem({ project: args.project, type: "subtask", title: args.title, description: args.description, parent: args.parent, board: args.board, priority: args.priority, statusKey: args.status, assignee: args.assignee, actor })
})
