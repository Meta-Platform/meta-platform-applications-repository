const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Anexa um link externo a um item. --comment associa a um comentário.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.AddLinkAttachment({ item: args.item, url: args.url, name: args.name, description: args.description, commentId: args.comment, actor })
})
