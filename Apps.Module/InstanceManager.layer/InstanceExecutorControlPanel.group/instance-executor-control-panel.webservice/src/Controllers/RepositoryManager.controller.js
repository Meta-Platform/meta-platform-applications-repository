const RepositoryExplorerController = (params) => {

    const { repositoryManagerService } = params
    
    // Resolve a identidade do pacote em caminho absoluto. O Launcher precisa do
    // caminho para executar pacotes CLI pelo CommandLineRuntime, que trabalha
    // com packagePath (e não com a identidade do pacote).
    const GetPackagePath = async (repositoryParams) => {
        const packagePath = await repositoryManagerService.GetPackagePath(repositoryParams)
        return { packagePath }
    }

    const controllerServiceObject = {
        controllerName : "RepositoryManagerController",
        GetPackageIcon         : repositoryManagerService.GetPackageIconPath,
        RegisterRepository     : repositoryManagerService.RegisterRepositoryInstallation,
        ListRepositories       : repositoryManagerService.ListRepositories,
        ListModules            : repositoryManagerService.ListModules,
        ListLayers             : repositoryManagerService.ListLayers,
        ListPackages           : repositoryManagerService.ListPackages,
        GetMetadataHierarchy   : repositoryManagerService.GetMetadataHierarchy,
        GetPackageDependencyHierarchy : repositoryManagerService.GetPackageDependencyHierarchy,
        GetPackagePath
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = RepositoryExplorerController