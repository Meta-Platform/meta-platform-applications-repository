const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.MoveItem({ item: args.item, parent: args.parent, actor })
})
