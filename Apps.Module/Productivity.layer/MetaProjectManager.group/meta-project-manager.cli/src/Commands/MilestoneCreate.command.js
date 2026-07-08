const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateMilestone({ project: args.project, name: args.name, description: args.description, targetDate: args.targetDate, status: args.status, actor })
})
