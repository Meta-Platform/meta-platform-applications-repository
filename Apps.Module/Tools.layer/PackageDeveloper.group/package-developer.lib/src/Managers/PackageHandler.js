const { promisify } = require("util")
const fs            = require("fs")
const readdir  = promisify(fs.readdir)

const PackageHandlerService = require("../Services/PackageHandler.service")

// Níveis de container da hierarquia Repository -> Module -> Layer -> Group -> Pacote.
const CONTAINER_SUFFIXES = [".Module", ".layer", ".group"]
const MAX_DEPTH = 8

const isContainer = (name) => CONTAINER_SUFFIXES.some((suffix) => name.endsWith(suffix))

// Um pacote é uma pasta com sufixo (name.webapp/.lib/.service/.app/.cli/...) que
// NÃO é um container de hierarquia e não é oculta/node_modules.
const isPackage = (name) =>
    !name.startsWith(".")
    && name !== "node_modules"
    && name.includes(".")
    && !isContainer(name)

// Varre recursivamente a partir do path da workspace (pode ser um Repository,
// Module, Layer ou Group), descendo pelos containers e coletando os pacotes.
const GetAllServiceParamsByPath = async (rootPath, depth = 0) => {
    let entries
    try{
        entries = await readdir(rootPath, { withFileTypes: true })
    }catch(e){
        if(["ENOENT", "ENOTDIR", "EACCES"].includes(e.code)) return []
        throw e
    }

    const results = []
    for(const entry of entries){
        if(!entry.isDirectory()) continue
        const name = entry.name
        if(name === "node_modules" || name.startsWith(".")) continue

        const fullPath = `${rootPath}/${name}`
        if(isPackage(name)){
            results.push({ path: fullPath, packageName: name })
        } else if(isContainer(name) && depth < MAX_DEPTH){
            results.push(...await GetAllServiceParamsByPath(fullPath, depth + 1))
        }
    }
    return results
}

const PackageHandlerManager = (params) => {

    const {
        workspaceStoreLib,
        workspaceStorageFilePath,
        onReady
    } = params

    const InitializeWorkspaceStore = workspaceStoreLib.require("InitializeWorkspaceStore")
    const store = InitializeWorkspaceStore(workspaceStorageFilePath)

    let listServices = []

    const _LoadService = (serviceParams) =>  {
        listServices.push(new PackageHandlerService({ ...serviceParams }))
    }

    // Varre o diretório de uma workspace e carrega os pacotes encontrados,
    // carimbando cada serviço com o workspaceName.
    const _LoadWorkspace = async ({ name, path }) => {
        try{
            const listServiceParams = await GetAllServiceParamsByPath(path)
            listServiceParams
             .forEach((serviceParams) => _LoadService({ ...serviceParams, workspaceName: name }))
        }catch(e){
            if(e.code === "ENOENT"){
                console.error(`O caminho "${path}" da Workspace "${name}" não foi encontrado!`)
            } else {
                throw e
            }
        }
    }

    // Recarrega TODAS as workspaces a partir do banco.
    const _LoadAllWorkspaces = async () => {
        listServices = []
        const workspaces = await store.List()
        await Promise.all(workspaces.map(_LoadWorkspace))
    }

    const _GetListServices = () => listServices

    const _ListWorkspaces = () => store.List()

    const _ListRecentWorkspaces = (limit) => store.ListRecent(limit)

    const _TouchWorkspace = ({ name }) => store.Touch({ name })

    const _GetState = (key) => store.GetState(key)
    const _SetState = (key, value) => store.SetState(key, value)

    const _GetWorkspace = ({ name }) => store.Get({ name })

    // Re-varre os pacotes de uma workspace existente (após criar/remover pacote).
    const _ReloadWorkspace = async ({ name }) => {
        const workspace = await store.Get({ name })
        if(!workspace) return
        listServices = listServices.filter((service) => service.workspaceName !== name)
        await _LoadWorkspace(workspace)
    }

    // Cria (ou atualiza) uma workspace no banco e carrega seus pacotes.
    const _CreateWorkspace = async ({ name, path }) => {
        const workspace = await store.Create({ name, path })
        listServices = listServices.filter((service) => service.workspaceName !== name)
        await _LoadWorkspace(workspace)
        return workspace
    }

    // Remove uma workspace do banco e descarrega seus pacotes.
    const _RemoveWorkspace = async ({ name }) => {
        const removed = await store.Remove({ name })
        listServices = listServices.filter((service) => service.workspaceName !== name)
        return removed
    }

    const _Run = async () => {
        await store.ConnectAndSync()
        await _LoadAllWorkspaces()
        onReady()
    }

    _Run()

    return {
        GetListServices      : _GetListServices,
        ListWorkspaces       : _ListWorkspaces,
        ListRecentWorkspaces : _ListRecentWorkspaces,
        TouchWorkspace       : _TouchWorkspace,
        GetState             : _GetState,
        SetState             : _SetState,
        GetWorkspace         : _GetWorkspace,
        ReloadWorkspace      : _ReloadWorkspace,
        CreateWorkspace      : _CreateWorkspace,
        RemoveWorkspace      : _RemoveWorkspace
    }

}

module.exports = PackageHandlerManager
