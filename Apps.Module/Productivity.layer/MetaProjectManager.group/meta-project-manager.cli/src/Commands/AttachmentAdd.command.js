const { Command } = require("../Utils/runtime")

// Anexa um arquivo local a um item (spec §7.5). --comment associa a um comentário.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddFileAttachment({
        item: args.item,
        filePath: args.file,
        name: args.name,
        description: args.description,
        type: args.type,
        commentId: args.comment,
        actor
    })
})
