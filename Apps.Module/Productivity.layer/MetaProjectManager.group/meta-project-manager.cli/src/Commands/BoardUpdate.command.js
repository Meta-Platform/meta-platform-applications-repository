const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateBoard({ board: args.board, name: args.name, description: args.description, type: args.type, actor })
})
