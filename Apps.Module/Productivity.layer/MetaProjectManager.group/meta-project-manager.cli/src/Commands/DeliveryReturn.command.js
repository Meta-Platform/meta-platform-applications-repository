const { Command } = require("../Utils/runtime")

// Devolver exige motivo — sem ele o agente repete o mesmo trabalho.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.ReturnDelivery({ delivery: args.delivery, reason: args.reason, reviewerType: "human", actor })
})
