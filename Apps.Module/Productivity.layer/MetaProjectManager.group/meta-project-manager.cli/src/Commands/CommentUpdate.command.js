const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateComment({ comment: args.comment, body: args.body, actor })
})
