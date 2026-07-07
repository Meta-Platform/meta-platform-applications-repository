const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, args }) => {
    return await store.UpdateAcceptanceCriteria({ criteria: args.criteria, text: args.text, met: args.met })
})
