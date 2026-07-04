
const FileSystemNavigatorController = (params) => {

    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage         = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const ListItem           = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/ListItem.function")
    const GetContentItem     = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetContentItem.function")
    const SaveContentItem    = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/SaveContentItem.function")
    const GetPackageMetadata = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetPackageMetadata.function")

    const _ListItem = ({packageName, workspace, ext, path}) =>  {
        const manager = packageHandlerManagerService
        const packageDevelopmentService = GetPackage(manager, {packageName, workspace, ext})
        return ListItem(packageDevelopmentService, path)
    }

    const _GetContentItem = ({packageName, workspace, ext, path}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) return undefined
        return GetContentItem(packageDevelopmentService, path)
    }

    const _SaveContentItem = ({packageName, workspace, ext, path, content}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        return SaveContentItem(packageDevelopmentService, path, content)
    }

    const _GetPackageMetadata = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) return undefined
        return GetPackageMetadata(packageDevelopmentService)
    }

    const controllerServiceObject =  {
        controllerName : "FileSystemNavigatorController",
        ListItem       : _ListItem,
        GetContentItem : _GetContentItem,
        SaveContentItem : _SaveContentItem,
        GetPackageMetadata : _GetPackageMetadata
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = FileSystemNavigatorController