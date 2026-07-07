const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListProjects({ status: args.status, includeArchived: args.all, limit: args.limit, offset: args.offset, sort: args.sort })
})
