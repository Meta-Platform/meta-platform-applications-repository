const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.SetStatus({ item: args.item, status: args.status, actor })
})
