const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.GetMilestone({ milestone: args.milestone })
})
