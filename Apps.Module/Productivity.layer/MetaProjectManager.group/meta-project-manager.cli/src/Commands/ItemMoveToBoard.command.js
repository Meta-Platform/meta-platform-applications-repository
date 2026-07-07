const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.MoveToBoard({ item: args.item, board: args.board, status: args.status, actor })
})
