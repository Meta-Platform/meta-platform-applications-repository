const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.DeleteComment({ comment: args.comment, actor })
}, { destructive: true })
