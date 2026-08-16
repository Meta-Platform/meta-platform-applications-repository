const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.UpdateUser({ user: args.user, name: args.name, handle: args.handle, email: args.email, status: args.status, actor })
})
