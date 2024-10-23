
const PackageTasksController = (params) => {

    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const GetIcon    = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetIcon.function")

    const _InstallDependencies = ({packageName, type, workspace}) => {
        GetPackage(packageHandlerManagerService, {packageName, type, workspace})
        .InstallDependencies()
    }
    
    const _ClearDependencies = ({packageName, type, workspace}) => {
        GetPackage(packageHandlerManagerService, {packageName, type, workspace})
        .ClearDependencies()
    }
    
    const _Develop = ({packageName, type, workspace}) => 
        GetPackage(packageHandlerManagerService, {packageName, type, workspace})
        .Develop()
    
    const _BuildArtifact = ({packageName, type, workspace}) =>
        GetPackage(packageHandlerManagerService, {packageName, type, workspace})
        .BuildArtifact()

    const _Start = ({packageName, type, workspace}) => 
        portfinder
        .getPortPromise()
        .then(port => GetPackage(packageHandlerManagerService, {packageName, type, workspace})
        .Start(port))

    const _GetIcon = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        return GetIcon(packageDevelopmentService.path)
    }

    const controllerServiceObject = {
        controllerName      : "PackageTasksController",
        InstallDependencies : _InstallDependencies,
        ClearDependencies   : _ClearDependencies,
        Develop             : _Develop,
        BuildArtifact       : _BuildArtifact,
        Start               : _Start,
        GetIcon             : _GetIcon
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = PackageTasksController