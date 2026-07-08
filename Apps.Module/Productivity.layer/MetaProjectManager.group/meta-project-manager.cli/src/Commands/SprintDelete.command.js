const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.DeleteSprint({ sprint: args.sprint, actor })
}, { destructive: true })
