
const GetPackagesByWorkspace = require("../Manager.Functions/GetPackagesByWorkspace.function")

// Estava sem `const`: a atribuição vazava para o objeto global (sloppy mode).
const ListPackagesByWorkspaceFunction = (packageHandlerService: any, {workspaceName}: any) => 
        GetPackagesByWorkspace(packageHandlerService, {workspaceName})
        .map(({name, ext, hasNodeModulesDir, jsonFiles}: any) => ({
            name, 
            ext,
            hasNodeModulesDir,
            ...jsonFiles.PackageJson ? {namespace:jsonFiles.PackageJson.name} : {}
        }))  

module.exports = ListPackagesByWorkspaceFunction