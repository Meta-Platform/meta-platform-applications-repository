const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.ListProjects({ status: args.status, includeArchived: args.all, limit: args.limit, offset: args.offset, sort: args.sort })
})
