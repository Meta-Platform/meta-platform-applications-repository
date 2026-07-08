const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateItem({ item: args.item, effort: args.effort, actor })
})
