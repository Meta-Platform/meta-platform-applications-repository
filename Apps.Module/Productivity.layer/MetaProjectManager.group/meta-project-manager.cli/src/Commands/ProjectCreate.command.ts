const { Command } = require("../Utils/runtime") as { Command: (businessFn: (ctx: any) => any, opts?: any) => (ctx: any) => Promise<any> }

module.exports = Command(async ({ store, actor, args }: any) => {
    return await store.CreateProject({ name: args.name, slug: args.slug, shortDescription: args.shortDescription, description: args.description, icon: args.icon, color: args.color, status: args.status, keyPrefix: args.keyPrefix, repositoryUrl: args.repositoryUrl, localPath: args.localPath, ownerUserId: args.owner, actor })
})
