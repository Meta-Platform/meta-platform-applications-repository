const { Command } = require("../Utils/runtime")

// Alias semântico de `activity list` — a auditoria É o registro de atividade.
module.exports = Command(async ({ store, actor, args }) => {
    const projectId = args.project && !args.allProjects
        ? (await store.ResolveProject(args.project)).id
        : undefined
    return await store.ListActivity({
        projectId, action: args.action, actorType: args.actorType, source: args.source,
        provider: args.provider, model: args.model, sessionId: args.session,
        from: args.from, to: args.to, limit: args.limit, offset: args.offset, actor
    })
})
