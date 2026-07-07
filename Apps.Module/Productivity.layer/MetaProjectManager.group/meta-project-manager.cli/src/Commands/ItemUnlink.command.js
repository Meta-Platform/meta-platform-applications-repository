const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UnlinkItem({ item: args.item, relation: args.relation, target: args.target, actor })
})
