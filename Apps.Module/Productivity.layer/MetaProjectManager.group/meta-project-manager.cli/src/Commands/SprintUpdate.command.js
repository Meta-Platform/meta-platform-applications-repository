const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateSprint({ sprint: args.sprint, name: args.name, goal: args.goal, startDate: args.startDate, endDate: args.endDate, status: args.status, actor })
})
