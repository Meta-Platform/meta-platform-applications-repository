const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListActivityNotes({
        project: args.project, board: args.board, sprint: args.sprint,
        milestone: args.milestone, item: args.item,
        from: args.from, to: args.to, limit: args.limit, offset: args.offset, actor
    })
})
