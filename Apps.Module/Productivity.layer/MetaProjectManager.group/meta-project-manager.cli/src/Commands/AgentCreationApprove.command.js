const { Command } = require("../Utils/runtime")

// Aprova um pedido de criação pendente e EXECUTA a criação.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.ApproveCreation({ request: args.request, actor })
})
