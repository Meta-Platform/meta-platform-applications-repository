const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.ListActivityNotes({
        project: args.project, board: args.board, sprint: args.sprint,
        milestone: args.milestone, item: args.item,
        from: args.from, to: args.to, limit: args.limit, offset: args.offset, actor
    })
})
