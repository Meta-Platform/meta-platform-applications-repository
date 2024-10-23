
const ModuleDeveloperController = (params) => {
    const { 
        packageHandlerManagerService,
        packageDeveloperLib
    } = params

    const GetPackage              = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const ListWorkspaces          = packageDeveloperLib.require("Manager.Functions/ListWorkspaces.function")
    const ListPackagesByWorkspace = packageDeveloperLib.require("Manager.Functions/ListPackagesByWorkspace.function")
    const GetIcon                 = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetIcon.function")

    const _ListWorkspaces = () => ListWorkspaces(packageHandlerManagerService)
        
    const _ListPackagesByWorkspace = (workspaceName) => 
        ListPackagesByWorkspace(packageHandlerManagerService, {workspaceName})
    
    const _Status = () =>  
        packageHandlerManagerService
        .GetListServices()
        .map(({
            workspace, 
            status, 
            name, 
            path
        }) => ({
            workspace,  
            status, 
            name, 
            path
        }))

    const _GetIcon = ({packageName, workspace, ext}) => {
        try{
            const packageDevelopmentService = 
                GetPackage(packageHandlerManagerService, {
                    packageName, 
                    workspace, 
                    ext
                })
            return GetIcon(packageDevelopmentService.path)
        }catch(e){
            //TODO temporario
            console.log("GetIcon Error!", packageName, workspace)
            return undefined
        }
    }

    const controllerServiceObject = {
        controllerName          : "ModuleDeveloperController",
        ListWorkspaces          : _ListWorkspaces,
        ListPackagesByWorkspace : _ListPackagesByWorkspace,
        Status                  : _Status,
        GetIcon                 : _GetIcon,
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = ModuleDeveloperController