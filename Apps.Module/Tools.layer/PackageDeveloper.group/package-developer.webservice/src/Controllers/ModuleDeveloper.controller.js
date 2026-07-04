const os   = require("os")
const fs   = require("fs")
const path = require("path")
const { promisify } = require("util")
const readdir = promisify(fs.readdir)

const AUTHOR = "Kaio Cezar <kadisk.shark@gmail.com>"
const PKG_CONF_DIRNAME_METADATA = "metadata"

// ext do package-developer -> função de scaffolding do package-toolkit.lib
const PACKAGE_CREATORS = {
    lib: "CreateLibPackage"
}

const ModuleDeveloperController = (params) => {
    const {
        packageHandlerManagerService,
        packageDeveloperLib,
        packageToolkitLib
    } = params

    const GetPackage              = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const ListPackagesByWorkspace = packageDeveloperLib.require("Manager.Functions/ListPackagesByWorkspace.function")
    const GetIcon                 = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetIcon.function")

    const _ListWorkspaces = async () =>
        (await packageHandlerManagerService.ListWorkspaces())
        .map(({ name }) => name)

    const _CreateWorkspace = ({ name, path }) =>
        packageHandlerManagerService.CreateWorkspace({ name, path })

    const _RemoveWorkspace = (name) =>
        packageHandlerManagerService.RemoveWorkspace({ name })

    // Navega diretórios do filesystem para escolher a pasta de um workspace.
    // `path` vazio -> home do usuário. Retorna apenas subdiretórios.
    const _BrowseDir = async (arg) => {
        const requested = typeof arg === "string" ? arg : (arg && arg.path) || ""
        const target = requested && requested.length > 0 ? requested : os.homedir()
        const entries = await readdir(target, { withFileTypes: true })
        const directories = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => ({ name: entry.name, path: path.resolve(target, entry.name) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        return {
            path: target,
            parent: path.dirname(target),
            directories
        }
    }

    // Cria um pacote (scaffold) dentro do diretório da workspace e re-varre.
    const _CreatePackage = async ({ workspace, packageName, ext }) => {
        const targetWorkspace = await packageHandlerManagerService.GetWorkspace({ name: workspace })
        if(!targetWorkspace) throw `Workspace "${workspace}" não encontrada`

        const creatorName = PACKAGE_CREATORS[ext]
        if(!creatorName) throw `Criação de pacote do tipo "${ext}" ainda não suportada`

        const CreatePackage = packageToolkitLib.require(creatorName)
        const packagePath = await CreatePackage({
            packageName,
            workingDirPath: targetWorkspace.path,
            author: AUTHOR,
            PKG_CONF_DIRNAME_METADATA
        })

        await packageHandlerManagerService.ReloadWorkspace({ name: workspace })

        return { workspace, packageName, ext, path: packagePath }
    }

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
        CreateWorkspace         : _CreateWorkspace,
        RemoveWorkspace         : _RemoveWorkspace,
        BrowseDir               : _BrowseDir,
        CreatePackage           : _CreatePackage,
        ListPackagesByWorkspace : _ListPackagesByWorkspace,
        Status                  : _Status,
        GetIcon                 : _GetIcon,
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = ModuleDeveloperController