const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// A mesa de revisão no terminal: o que espera por você agora.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.ReviewDesk({ project: args.project, limit: args.limit })
})
