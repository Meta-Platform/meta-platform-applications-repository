const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Liga o modelo de entrega num projeto. Ação humana: é ela que muda como o
// agente é governado ali. Reversível por `project rollback-delivery`.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.MigrateProjectToDeliveryModel({ project: args.project, actor })
})
