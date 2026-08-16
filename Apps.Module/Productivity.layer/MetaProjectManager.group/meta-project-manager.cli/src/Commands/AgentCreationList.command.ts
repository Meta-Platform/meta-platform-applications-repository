const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Lista pedidos de criação (projeto/board) feitos por agentes.
module.exports = Command(async ({ store, args }: any) => {
    return await store.ListCreationRequests({ type: args.type, status: args.status || "pending" })
})
