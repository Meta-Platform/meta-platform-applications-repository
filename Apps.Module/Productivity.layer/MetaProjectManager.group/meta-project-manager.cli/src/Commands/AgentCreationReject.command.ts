const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Rejeita um pedido de aprovação pendente (nada é criado/removido). Motivo via --reason.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.RejectRequest({ request: args.request, reason: args.reason, actor })
})
