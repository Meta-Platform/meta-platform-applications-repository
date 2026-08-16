const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.SubmitDelivery({
        item: args.item, summary: args.summary, title: args.title,
        verifyCommand: args["verify-command"], actor
    })
})
