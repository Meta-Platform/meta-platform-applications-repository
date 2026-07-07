const { Command } = require("../Utils/runtime")

module.exports = Command(async ({ store, actor, args }) => {
    return await store.CreateItem({ project: args.project, type: args.type, title: args.title, description: args.description, parent: args.parent, board: args.board, priority: args.priority, statusKey: args.status, assignee: args.assignee, reporter: args.reporter, dueDate: args.dueDate, startDate: args.startDate, estimatePoints: args.estimatePoints, estimateMinutes: args.estimateMinutes, labels: args.labels, repositoryUrl: args.repositoryUrl, branchName: args.branchName, commitHash: args.commitHash, pullRequestUrl: args.pullRequestUrl, environment: args.environment, packagePath: args.packagePath, moduleName: args.moduleName, layerName: args.layerName, groupName: args.groupName, actor })
})
