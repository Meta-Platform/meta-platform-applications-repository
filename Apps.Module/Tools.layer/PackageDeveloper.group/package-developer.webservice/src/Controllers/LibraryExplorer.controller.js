
const LibraryExplorerController = (params) => {

    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage        = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const GetLibraryService = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetLibraryService.function")
    
    const _GetDetails = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const libService = GetLibraryService(packageDevelopmentService)
        return libService.GetDetails()
    }

    const _GetBoot = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const libService = GetLibraryService(packageDevelopmentService)
        return libService.GetBoot()
    }

    const _GetServices = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const libService = GetLibraryService(packageDevelopmentService)
        return libService.GetServices()
    }
    
    const _GetManagers = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const libService = GetLibraryService(packageDevelopmentService)
        return libService.GetManagers()
    }

    const controllerServiceObject = {
        controllerName : "LibraryExplorerController",
        GetDetails     : _GetDetails,
        GetBoot        : _GetBoot,
        GetServices    : _GetServices,
        GetManagers    : _GetManagers
    }

    return Object.freeze(controllerServiceObject)

}

module.exports = LibraryExplorerController