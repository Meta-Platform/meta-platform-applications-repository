const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateItem({ item: args.item, area: args.area, actor })
})
