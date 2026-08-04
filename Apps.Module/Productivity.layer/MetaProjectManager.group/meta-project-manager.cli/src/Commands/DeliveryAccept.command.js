const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.AcceptDelivery({ delivery: args.delivery, note: args.note, actor })
})
