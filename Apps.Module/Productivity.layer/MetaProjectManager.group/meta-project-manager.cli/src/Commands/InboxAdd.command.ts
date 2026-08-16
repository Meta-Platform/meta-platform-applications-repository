const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.CreateItem({ project: args.project, type: args.type || "task", title: args.title, description: args.description, horizon: "inbox", clarityState: "idea", area: args.area, ideaOrigin: args.ideaOrigin, actor })
})
