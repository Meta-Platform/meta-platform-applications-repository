const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddAcceptanceCriteria({ item: args.item, text: args.text })
})
