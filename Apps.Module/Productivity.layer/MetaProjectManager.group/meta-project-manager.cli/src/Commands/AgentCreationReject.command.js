const { Command } = require("../Utils/runtime")

// Rejeita um pedido de criação pendente (nada é criado).
module.exports = Command(async ({ store, actor, args }) => {
    return await store.RejectCreation({ request: args.request, actor })
})
