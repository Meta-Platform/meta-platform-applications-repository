const RepositoryExplorerController = (params) => {

    const { repositoryManagerService } = params
    
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
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = RepositoryExplorerController