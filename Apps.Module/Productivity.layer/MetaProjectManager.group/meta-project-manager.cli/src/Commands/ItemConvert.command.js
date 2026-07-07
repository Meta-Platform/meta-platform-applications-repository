const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ConvertItem({ item: args.item, type: args.type, actor })
})
