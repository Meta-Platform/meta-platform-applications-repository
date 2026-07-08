const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AssignItemPlanning({ item: args.item, sprint: args.sprint, actor })
})
