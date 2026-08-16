const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.CreateMandate({
        project: args.project, title: args.title, shortDescription: args["short-description"],
        session: args.session, agent: args.agent,
        maxDeliveries: args["max-deliveries"],
        maxUnreviewedDeliveries: args["max-unreviewed"],
        maxConsecutiveReturns: args["max-returns"],
        expiresAt: args["expires-at"], actor
    })
})
