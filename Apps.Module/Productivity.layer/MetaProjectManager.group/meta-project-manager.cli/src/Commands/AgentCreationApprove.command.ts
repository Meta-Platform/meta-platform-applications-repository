const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Aprova um pedido de criação pendente e EXECUTA a criação.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.ApproveCreation({ request: args.request, actor })
})
