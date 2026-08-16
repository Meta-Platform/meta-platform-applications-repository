const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// `--view review` traz o que decide a revisão: critérios, todas as evidências,
// as rodadas anteriores com o motivo de cada devolução.
module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.GetDelivery({ delivery: args.delivery, view: args.view })
})
