const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.ArchiveUser({ user: args.user, force: args.force, actor })
}, { destructive: true })
