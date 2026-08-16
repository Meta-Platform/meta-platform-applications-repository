const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Devolver exige motivo — sem ele o agente repete o mesmo trabalho.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.ReturnDelivery({ delivery: args.delivery, reason: args.reason, reviewerType: "human", actor })
})
