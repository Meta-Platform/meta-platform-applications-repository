const { Command } = require("../Utils/runtime")

// Roadmap por data-alvo (milestones) ou por horizonte (--by horizon).
module.exports = Command(async ({ store, args }) => {
    return args.by === "horizon"
        ? await store.RoadmapByHorizon({ project: args.project })
        : await store.Roadmap({ project: args.project })
})
