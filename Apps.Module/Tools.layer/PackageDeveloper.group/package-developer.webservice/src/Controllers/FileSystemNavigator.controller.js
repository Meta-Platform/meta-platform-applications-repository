
const FileSystemNavigatorController = (params) => {

    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage     = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const ListItem       = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/ListItem.function")
    const GetContentItem = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetContentItem.function")

    const _ListItem = ({packageName, workspace, ext, path}) =>  {
        const manager = packageHandlerManagerService
        const packageDevelopmentService = GetPackage(manager, {packageName, workspace, ext})
        return ListItem(packageDevelopmentService, path)
    }
       
    const _GetContentItem = ({packageName, workspace, path}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        return GetContentItem(packageDevelopmentService, path)
    }

    const controllerServiceObject =  {
        controllerName : "FileSystemNavigatorController",
        ListItem       : _ListItem,
        GetContentItem : _GetContentItem
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = FileSystemNavigatorController