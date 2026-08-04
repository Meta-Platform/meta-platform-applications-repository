const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListDeliveries({
        project: args.project, item: args.item, status: args.status,
        limit: args.limit, offset: args.offset
    })
})
