
GetPackagesByWorkspaceFunction = (packageHandlerService, {workspaceName}) => 
    packageHandlerService
    .GetListServices()
    .filter((packageNameService) => packageNameService.workspaceName === workspaceName)

module.exports = GetPackagesByWorkspaceFunction