const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateProject({ name: args.name, slug: args.slug, description: args.description, icon: args.icon, color: args.color, status: args.status, keyPrefix: args.keyPrefix, repositoryUrl: args.repositoryUrl, localPath: args.localPath, ownerUserId: args.owner, actor })
})
