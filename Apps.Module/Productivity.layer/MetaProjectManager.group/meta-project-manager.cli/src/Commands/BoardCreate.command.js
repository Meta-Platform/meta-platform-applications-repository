const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateBoard({ project: args.project, name: args.name, description: args.description, type: args.type, setDefault: args.default, actor })
})
