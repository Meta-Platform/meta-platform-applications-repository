const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.DuplicateBoard({ board: args.board, name: args.name, actor })
})
