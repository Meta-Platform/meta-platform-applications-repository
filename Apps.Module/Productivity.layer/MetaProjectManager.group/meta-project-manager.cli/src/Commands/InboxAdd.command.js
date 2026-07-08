const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateItem({ project: args.project, type: args.type || "task", title: args.title, description: args.description, horizon: "inbox", clarityState: "idea", area: args.area, ideaOrigin: args.ideaOrigin, actor })
})
