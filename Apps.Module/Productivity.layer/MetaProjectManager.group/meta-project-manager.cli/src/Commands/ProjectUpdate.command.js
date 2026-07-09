const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateProject({ project: args.project, name: args.name, slug: args.slug, shortDescription: args.shortDescription, description: args.description, status: args.status, icon: args.icon, color: args.color, ownerUserId: args.owner, repositoryUrl: args.repositoryUrl, localPath: args.localPath, actor })
})
