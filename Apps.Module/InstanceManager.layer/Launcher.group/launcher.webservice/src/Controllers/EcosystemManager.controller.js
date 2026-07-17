// Gerenciador de pacotes/processos do painel — DELEGA ao daemon executor-manager
// (via instance-manager-runtime.service → @/instance-manager-client.lib).
// O painel resolve a identidade do pacote em caminho e pede a execução/encerramento
// ao daemon; a lista de pacotes supervisionados vem do daemon.
const EcosystemManagerController = (params) => {

    const {
        instanceManagerRuntimeService,
        repositoryManagerService
    } = params

    const _ResolvePath = async ({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, packagePath }) => {
        if(packagePath) return packagePath
        return repositoryManagerService.GetPackagePath({
            namespaceRepo, moduleName, layerName, packageName, ext,
            ...parentGroup ? { parentGroup } : {}
        })
    }

    // Ponte WS: repassa ao navegador a lista de pacotes supervisionados que o
    // daemon empurra a cada mudança de status.
    const PackageList = async (ws) => {
        let daemonWs
        try { daemonWs = await instanceManagerRuntimeService.OpenPackageListStream() }
        catch(e){ try { ws.close() } catch(_){}; return }
        daemonWs.on("message", (raw) => { try { ws.send(raw.toString()) } catch(e){} })
        daemonWs.on("close", () => { try { ws.close() } catch(e){} })
        daemonWs.on("error", () => {})
        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e){} })
    }

    const RunPackage = async ({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, packagePath, startupParams, launchedBy }) => {
        try {
            const path = await _ResolvePath({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, packagePath })
            await instanceManagerRuntimeService.RunPackage({ packagePath: path, startupParams, launchedBy })
            return { started: true, packagePath: path }
        } catch(e){
            console.log(e)
            throw e
        }
    }

    // Encerra TODAS as instâncias de um pacote (delega StopPackage ao daemon).
    const StopPackage = async ({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, packagePath }) => {
        try {
            const path = await _ResolvePath({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, packagePath })
            const result = await instanceManagerRuntimeService.StopPackage({ packagePath: path })
            return { ...result, packagePath: path }
        } catch(e){
            console.log(e)
            throw e
        }
    }

    // Encerra UMA instância pelo seu id — um mesmo pacote desktop pode estar
    // aberto várias vezes, e o monitor lista uma linha por instância.
    // 1 parâmetro (instanceId) chega como valor direto (contrato do server-manager).
    const StopInstance = async (instanceId) => {
        try {
            return await instanceManagerRuntimeService.StopInstance({ instanceId })
        } catch(e){
            console.log(e)
            throw e
        }
    }

    return Object.freeze({
        controllerName : "EcosystemManagerController",
        RunPackage,
        StopPackage,
        StopInstance,
        ListPackages: instanceManagerRuntimeService.ListPackages,
        PackageList
    })
}

module.exports = EcosystemManagerController
