const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListItems({ project: args.project, horizon: "inbox", sort: args.sort })
})
