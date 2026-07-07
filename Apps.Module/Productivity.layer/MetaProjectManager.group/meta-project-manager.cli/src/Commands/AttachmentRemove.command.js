const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.RemoveAttachment({ attachment: args.attachment, actor })
}, { destructive: true })
