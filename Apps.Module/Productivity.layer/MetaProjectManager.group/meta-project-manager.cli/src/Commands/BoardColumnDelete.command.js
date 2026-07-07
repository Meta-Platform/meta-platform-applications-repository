const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.DeleteColumn({ column: args.column, actor })
}, { destructive: true })
