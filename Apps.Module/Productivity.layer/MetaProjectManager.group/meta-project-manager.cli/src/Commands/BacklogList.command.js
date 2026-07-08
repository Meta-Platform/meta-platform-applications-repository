const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ListItems({ project: args.project, horizon: args.horizon, area: args.area, type: args.type, sort: args.sort || "value" })
})
