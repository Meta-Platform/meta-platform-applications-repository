const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.CreateAgent({ provider: args.provider, owner: args.owner, name: args.name, handle: args.handle, defaultModel: args.defaultModel, externalAgentId: args.externalAgentId, description: args.description, actor })
})
