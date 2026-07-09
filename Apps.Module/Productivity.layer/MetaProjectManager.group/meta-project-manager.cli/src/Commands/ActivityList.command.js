const { Command } = require("../Utils/runtime")

// Auditoria: quem/qual sessão fez o quê. Sem --project (ou com --all-projects) a
// consulta é GLOBAL — para AGENTES exige a permissão activity:read:all_projects.
module.exports = Command(async ({ store, actor, args }) => {
    const projectId = args.project && !args.allProjects
        ? (await store.ResolveProject(args.project)).id
        : undefined
    return await store.ListActivity({
        projectId,
        entityType: args.entityType,
        entityId: args.entityId,
        action: args.action,
        actorUserId: args.actor,
        actorType: args.actorType,
        source: args.source,
        provider: args.provider,
        model: args.model,
        sessionId: args.session,
        from: args.from,
        to: args.to,
        limit: args.limit,
        offset: args.offset,
        actor
    })
})
