const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.MoveColumn({ column: args.column, order: args.order, actor })
})
