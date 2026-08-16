const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, args }: any) => {
    return await store.UpdateAcceptanceCriteria({ criteria: args.criteria, text: args.text, met: args.met })
})
