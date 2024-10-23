    
const WebguiExplorerController = (params) => {

    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage       = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const GetWebguiService = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetWebguiService.function")

    const _GetDetails = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const uiService = GetWebguiService(packageDevelopmentService)
        return uiService.GetDetails()
    }

    const _GetBoot = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const uiService = GetWebguiService(packageDevelopmentService)
        return uiService.GetBoot()
    }

    const _GetRoutes = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        const uiService = GetWebguiService(packageDevelopmentService)
        return uiService.GetRoutes()
    }

    const controllerServiceObject = {
        controllerName : "WebguiExplorerController",
        GetDetails     : _GetDetails,
        GetBoot        : _GetBoot,
        GetRoutes      : _GetRoutes
    }

    return Object.freeze(controllerServiceObject)
    
}

module.exports = WebguiExplorerController