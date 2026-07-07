const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddLinkAttachment({ item: args.item, url: args.url, name: args.name, description: args.description, actor })
})
