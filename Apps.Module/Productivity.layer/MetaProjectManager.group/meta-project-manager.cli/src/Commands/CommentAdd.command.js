const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddComment({ item: args.item, body: args.body, format: args.format, actor })
})
