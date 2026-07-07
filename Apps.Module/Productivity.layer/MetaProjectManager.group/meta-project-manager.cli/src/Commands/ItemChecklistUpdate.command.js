const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, args }) => {
    return await store.UpdateChecklistItem({ checklistItem: args.checklistItem, text: args.text, done: args.done })
})
