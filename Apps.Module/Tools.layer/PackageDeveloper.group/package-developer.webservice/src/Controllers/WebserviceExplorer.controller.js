
const WebserviceExplorerController = (params) => {

    const { 
        packageHandlerManagerService,
        packageDeveloperLib
     } = params

    const GetPackage           = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const GetWebserviceService = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetWebserviceService.function")

    const _GetDetails = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const webService = GetWebserviceService(packageDevelopmentService)
        return webService.GetDetails()
    }
    const _GetBoot = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const webService = GetWebserviceService(packageDevelopmentService)
        return webService.GetBoot()
    }

    const _GetAPIs = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const webService = GetWebserviceService(packageDevelopmentService)
        return webService.GetAPIs()
    }
    const _GetControllers = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const webService = GetWebserviceService(packageDevelopmentService)
        return webService.GetControllers()
    }

    const controllerServiceObject = {
        controllerName : "WebserviceExplorerController",
        GetDetails     : _GetDetails,
        GetBoot        : _GetBoot,
        GetAPIs        : _GetAPIs,
        GetControllers : _GetControllers
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = WebserviceExplorerController