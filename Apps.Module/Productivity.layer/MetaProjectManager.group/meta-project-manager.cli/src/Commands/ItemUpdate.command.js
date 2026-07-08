const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.UpdateItem({ item: args.item, title: args.title, description: args.description, statusKey: args.status, priority: args.priority, progress: args.progress, dueDate: args.dueDate, startDate: args.startDate, assignee: args.assignee, labels: args.labels, blockedReason: args.blockedReason, repositoryUrl: args.repositoryUrl, branchName: args.branchName, commitHash: args.commitHash, pullRequestUrl: args.pullRequestUrl, environment: args.environment, packagePath: args.packagePath, moduleName: args.moduleName, layerName: args.layerName, groupName: args.groupName, horizon: args.horizon, clarityState: args.clarity, effort: args.effort, value: args.value, area: args.area, ideaOrigin: args.ideaOrigin, actor })
})
