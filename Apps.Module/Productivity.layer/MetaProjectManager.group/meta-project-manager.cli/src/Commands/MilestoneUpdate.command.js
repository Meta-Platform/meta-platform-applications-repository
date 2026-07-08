const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateMilestone({ milestone: args.milestone, name: args.name, description: args.description, targetDate: args.targetDate, status: args.status, actor })
})
