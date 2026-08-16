const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.UpdateColumn({ column: args.column, name: args.name, statusKey: args.statusKey, color: args.color, wipLimit: args.wipLimit, isDoneColumn: args.done, actor })
})
