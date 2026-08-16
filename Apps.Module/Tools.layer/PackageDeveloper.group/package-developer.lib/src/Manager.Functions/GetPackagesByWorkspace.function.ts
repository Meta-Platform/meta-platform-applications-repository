
// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const GetPackagesByWorkspaceFunction = (packageHandlerService: any, {workspaceName}: any) => 
    packageHandlerService
    .GetListServices()
    .filter((packageNameService: any) => packageNameService.workspaceName === workspaceName)

module.exports = GetPackagesByWorkspaceFunction