const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListActivity({ projectId: args.project ? (await store.ResolveProject(args.project)).id : undefined, limit: args.limit, offset: args.offset })
})
