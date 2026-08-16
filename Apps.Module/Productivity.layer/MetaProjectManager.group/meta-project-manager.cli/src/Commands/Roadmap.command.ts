const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

// Roadmap por data-alvo (milestones) ou por horizonte (--by horizon).
module.exports = Command(async ({ store, args }: any) => {
    return args.by === "horizon"
        ? await store.RoadmapByHorizon({ project: args.project })
        : await store.Roadmap({ project: args.project })
})
