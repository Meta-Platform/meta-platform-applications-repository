const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, args }: any) => {
    return await store.RemoveChecklistItem({ checklistItem: args.checklistItem })
}, { destructive: true })
