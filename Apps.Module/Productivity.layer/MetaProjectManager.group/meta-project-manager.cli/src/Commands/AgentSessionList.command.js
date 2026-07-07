const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListSessions({ agent: args.agent, status: args.status })
})
