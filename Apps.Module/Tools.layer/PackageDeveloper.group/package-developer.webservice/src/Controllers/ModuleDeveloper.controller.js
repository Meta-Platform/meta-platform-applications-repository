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
    const IsRepository            = packageDeveloperLib.require("Manager.Functions/IsRepository.function")
    const GetRepositoryHierarchy  = packageDeveloperLib.require("Manager.Functions/GetRepositoryHierarchy.function")

    const PICKER_LAST_DIR_KEY = "picker:lastDir"

    const _ListWorkspaces = async () =>
        (await packageHandlerManagerService.ListWorkspaces())
        .map(({ name }) => name)

    // Repositórios recentes (para a tela de boas-vindas), ordenados por acesso.
    const _ListRecentRepositories = (limit) =>
        packageHandlerManagerService.ListRecentWorkspaces(limit)

    // Só permite adicionar Repositories (dir com metadata/applications.json válido).
    const _CreateWorkspace = async ({ name, path }) => {
        const isRepo = await IsRepository(path)
        if(!isRepo) throw `"${path}" não é um Repository válido (falta metadata/applications.json)`
        return packageHandlerManagerService.CreateWorkspace({ name, path })
    }

    const _RemoveWorkspace = (name) =>
        packageHandlerManagerService.RemoveWorkspace({ name })

    // Hierarquia do repositório (Module -> Layer -> [Group] -> Package). Marca acesso.
    const _GetRepositoryHierarchy = async (name) => {
        const repo = await packageHandlerManagerService.GetWorkspace({ name })
        if(!repo) throw `Repository "${name}" não encontrado`
        await packageHandlerManagerService.TouchWorkspace({ name })
        return GetRepositoryHierarchy(repo.path)
    }

    // Navegador de diretórios do picker. `path` vazio -> última pasta salva (ou
    // home). Marca cada subdir que é um Repository e persiste a pasta atual.
    const _BrowseDir = async (arg) => {
        const requested = typeof arg === "string" ? arg : (arg && arg.path) || ""
        let target = requested
        if(!target || target.length === 0){
            const lastDir = await packageHandlerManagerService.GetState(PICKER_LAST_DIR_KEY)
            target = lastDir || os.homedir()
        }

        const entries = (await readdir(target, { withFileTypes: true })).filter((e) => e.isDirectory())
        const directories = await Promise.all(entries.map(async (entry) => {
            const fullPath = path.resolve(target, entry.name)
            return { name: entry.name, path: fullPath, isRepository: await IsRepository(fullPath) }
        }))
        directories.sort((a, b) => a.name.localeCompare(b.name))

        await packageHandlerManagerService.SetState(PICKER_LAST_DIR_KEY, target)

        return { path: target, parent: path.dirname(target), directories }
    }

    // Memória da IDE (posições de abas, etc.).
    const _GetAppState = (key) => packageHandlerManagerService.GetState(key)
    const _SetAppState = ({ key, value }) => packageHandlerManagerService.SetState(key, value)

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
        ListRecentRepositories  : _ListRecentRepositories,
        CreateWorkspace         : _CreateWorkspace,
        RemoveWorkspace         : _RemoveWorkspace,
        GetRepositoryHierarchy  : _GetRepositoryHierarchy,
        BrowseDir               : _BrowseDir,
        GetAppState             : _GetAppState,
        SetAppState             : _SetAppState,
        CreatePackage           : _CreatePackage,
        ListPackagesByWorkspace : _ListPackagesByWorkspace,
        Status                  : _Status,
        GetIcon                 : _GetIcon,
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = ModuleDeveloperController