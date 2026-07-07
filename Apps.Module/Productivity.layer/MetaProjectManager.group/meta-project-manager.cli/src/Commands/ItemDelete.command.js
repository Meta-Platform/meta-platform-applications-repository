const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.DeleteItem({ item: args.item, actor })
}, { destructive: true })
