const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Anexa um arquivo local a um item (spec §7.5). --comment associa a um comentário.
module.exports = Command(async ({ store, actor, args }: any) => {
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
