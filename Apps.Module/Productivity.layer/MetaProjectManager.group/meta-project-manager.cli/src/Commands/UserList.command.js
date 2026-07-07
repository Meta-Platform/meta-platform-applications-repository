const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListUsers({ type: args.type, status: args.status })
})
