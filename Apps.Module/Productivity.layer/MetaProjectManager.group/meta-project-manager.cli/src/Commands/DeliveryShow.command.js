const { Command } = require("../Utils/runtime")

// `--view review` traz o que decide a revisão: critérios, todas as evidências,
// as rodadas anteriores com o motivo de cada devolução.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.GetDelivery({ delivery: args.delivery, view: args.view })
})
