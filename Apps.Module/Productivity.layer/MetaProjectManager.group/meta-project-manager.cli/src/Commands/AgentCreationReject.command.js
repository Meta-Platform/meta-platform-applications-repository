const { Command } = require("../Utils/runtime")

// Rejeita um pedido de aprovação pendente (nada é criado/removido). Motivo via --reason.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.RejectRequest({ request: args.request, reason: args.reason, actor })
})
