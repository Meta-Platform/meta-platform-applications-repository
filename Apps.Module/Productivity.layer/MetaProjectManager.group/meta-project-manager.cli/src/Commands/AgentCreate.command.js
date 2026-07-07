const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateAgent({ provider: args.provider, owner: args.owner, name: args.name, handle: args.handle, defaultModel: args.defaultModel, externalAgentId: args.externalAgentId, description: args.description, actor })
})
