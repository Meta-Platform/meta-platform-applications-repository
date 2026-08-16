const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.CreateBoard({ project: args.project, name: args.name, description: args.description, type: args.type, setDefault: args.default, actor })
})
