const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, args }) => {
    return await store.RemoveAcceptanceCriteria({ criteria: args.criteria })
}, { destructive: true })
