const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.UpdateMilestone({ milestone: args.milestone, name: args.name, description: args.description, targetDate: args.targetDate, status: args.status, actor })
})
