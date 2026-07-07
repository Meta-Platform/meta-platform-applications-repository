const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ReorderItem({ item: args.item, order: args.order, actor })
})
