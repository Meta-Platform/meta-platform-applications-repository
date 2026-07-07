const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, args }) => {
    return await store.RemoveChecklistItem({ checklistItem: args.checklistItem })
}, { destructive: true })
