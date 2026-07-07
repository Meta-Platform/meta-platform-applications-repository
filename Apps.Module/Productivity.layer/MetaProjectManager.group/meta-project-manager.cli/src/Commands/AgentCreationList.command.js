const { Command } = require("../Utils/runtime")

// Lista pedidos de criação (projeto/board) feitos por agentes.
module.exports = Command(async ({ store, args }) => {
    return await store.ListCreationRequests({ type: args.type, status: args.status || "pending" })
})
