const { Command } = require("../Utils/runtime")

// Anexa um link externo a um item. --comment associa a um comentário.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.AddLinkAttachment({ item: args.item, url: args.url, name: args.name, description: args.description, commentId: args.comment, actor })
})
