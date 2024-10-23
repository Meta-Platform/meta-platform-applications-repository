
const GetPackagesByWorkspace = require("../Manager.Functions/GetPackagesByWorkspace.function")

ListPackagesByWorkspaceFunction = (packageHandlerService, {workspaceName}) => 
        GetPackagesByWorkspace(packageHandlerService, {workspaceName})
        .map(({name, ext, hasNodeModulesDir, jsonFiles}) => ({
            name, 
            ext,
            hasNodeModulesDir,
            ...jsonFiles.PackageJson ? {namespace:jsonFiles.PackageJson.name} : {}
        }))  

module.exports = ListPackagesByWorkspaceFunction