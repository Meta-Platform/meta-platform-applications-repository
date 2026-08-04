const { Command } = require("../Utils/runtime")

// A mesa de revisão no terminal: o que espera por você agora.
module.exports = Command(async ({ store, actor, args }) => {
    return await store.ReviewDesk({ project: args.project, limit: args.limit })
})
