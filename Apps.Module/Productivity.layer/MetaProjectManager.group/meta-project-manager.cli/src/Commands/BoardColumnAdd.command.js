const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddColumn({ board: args.board, name: args.name, statusKey: args.statusKey, color: args.color, wipLimit: args.wipLimit, isDoneColumn: args.done, actor })
})
