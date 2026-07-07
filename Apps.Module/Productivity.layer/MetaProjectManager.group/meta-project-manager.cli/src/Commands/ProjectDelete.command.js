const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.DeleteProject({ project: args.project, actor })
}, { destructive: true })
