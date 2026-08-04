const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.SubmitDelivery({
        item: args.item, summary: args.summary, title: args.title,
        verifyCommand: args["verify-command"], actor
    })
})
