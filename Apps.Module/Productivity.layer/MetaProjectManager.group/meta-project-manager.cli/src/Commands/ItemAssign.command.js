const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.Assign({ item: args.item, user: args.user, actor })
})
