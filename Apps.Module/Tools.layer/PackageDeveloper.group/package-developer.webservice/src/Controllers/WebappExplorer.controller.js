
const WebappExplorerController = (params) => {
    
    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const GetDetails = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetDetails.function")
    const GetBoot    = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetBoot.function")

    const _GetDetails = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        return GetDetails(packageDevelopmentService)
    }

    const _GetBoot = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        return GetBoot(packageDevelopmentService)
    } 
    
    const controllerServiceObject = {
        controllerName : "WebappExplorerController",
        GetDetails     : _GetDetails,
        GetBoot        : _GetBoot
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = WebappExplorerController