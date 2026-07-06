const path = require("path")

const FileSystemNavigatorController = (params) => {

    const {
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage         = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const ListItem           = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/ListItem.function")
    const GetContentItem     = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetContentItem.function")
    const SaveContentItem    = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/SaveContentItem.function")
    const CreateContentItem  = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/CreateContentItem.function")
    const RenameContentItem  = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/RenameContentItem.function")
    const DeleteContentItem  = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/DeleteContentItem.function")
    const GetPackageMetadata = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetPackageMetadata.function")

    // Garante que um caminho relativo não escapa da raiz do pacote (path traversal).
    const _AssertInsidePackage = (storePath, itemPath) => {
        const resolved = path.resolve(storePath + (itemPath || ""))
        const root = path.resolve(storePath)
        if(resolved !== root && !resolved.startsWith(root + path.sep))
            throw `Caminho "${itemPath}" fora do pacote`
        return itemPath
    }

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

    const _CreateContentItem = ({packageName, workspace, ext, path: itemPath, content}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        _AssertInsidePackage(packageDevelopmentService.path, itemPath)
        return CreateContentItem(packageDevelopmentService, itemPath, content || "")
    }

    const _RenameContentItem = ({packageName, workspace, ext, path: fromPath, newPath: toPath}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        _AssertInsidePackage(packageDevelopmentService.path, fromPath)
        _AssertInsidePackage(packageDevelopmentService.path, toPath)
        return RenameContentItem(packageDevelopmentService, fromPath, toPath)
    }

    const _DeleteContentItem = ({packageName, workspace, ext, path: itemPath}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) throw `Pacote "${packageName}" (${ext}) não encontrado na workspace "${workspace}"`
        _AssertInsidePackage(packageDevelopmentService.path, itemPath)
        return DeleteContentItem(packageDevelopmentService, itemPath)
    }

    const controllerServiceObject =  {
        controllerName : "FileSystemNavigatorController",
        ListItem       : _ListItem,
        GetContentItem : _GetContentItem,
        SaveContentItem : _SaveContentItem,
        CreateContentItem : _CreateContentItem,
        RenameContentItem : _RenameContentItem,
        DeleteContentItem : _DeleteContentItem,
        GetPackageMetadata : _GetPackageMetadata
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = FileSystemNavigatorController