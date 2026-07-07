const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddChecklistItem({ item: args.item, text: args.text, actor })
})
