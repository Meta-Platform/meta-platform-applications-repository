// Execução de aplicações do MyDesktop — DELEGADA ao daemon executor-manager.
//
// O painel não spawna mais `run package` diretamente: resolve o caminho do
// pacote e pede ao daemon (via @/instance-manager-client.lib) que o execute.
// A execução é, assim, centralizada num único ponto (o daemon).
const ExecutionController = (params) => {

    const {
        repositoryManagerService,
        notificationHubService,
        instanceManagerClientLib,
        platformApplicationSocketPath
    } = params

    const { NotifyEvent } = notificationHubService

    const CreateInstanceManagerClient = instanceManagerClientLib.require("CreateInstanceManagerClient")
    const instanceManager = CreateInstanceManagerClient({ platformApplicationSocketPath })

    // Mapa em memória do que ESTE painel iniciou nesta sessão, nos dois sentidos.
    // Usado para casar o contrato do webgui (que fala em executableName) com o
    // daemon (que fala em packagePath e instanceId).
    const executableToPath = new Map()
    const pathToExecutable = new Map()

    const _RememberExecutable = (executableName, packagePath) => {
        if(!executableName || !packagePath) return
        executableToPath.set(executableName, packagePath)
        pathToExecutable.set(packagePath, executableName)
    }

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    // Lança uma aplicação instalada. Recebe a IDENTIDADE do pacote
    // (namespaceRepo/moduleName/...) — o caminho é resolvido aqui e a execução
    // é feita PELO DAEMON.
    const RunApplication = async ({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, executableName }) => {
        const packageData = { namespaceRepo, moduleName, layerName, packageName, ext, parentGroup }
        const packagePath = await repositoryManagerService.GetPackagePath(packageData)

        if(!packagePath){
            const message = `Pacote não encontrado: ${packageName}.${ext}`
            _Notify("Execution.RunApplication", "error", message)
            throw message
        }

        if(!(await instanceManager.IsAvailable())){
            const message = "O serviço de execução da plataforma não está em execução, "
                + "por isso nenhuma aplicação pode ser iniciada.\n\n"
                + "**O que fazer:**\n"
                + "1. Abra um terminal e execute `executor-manager`.\n"
                + "2. Clique novamente no aplicativo."
            _Notify("Execution.RunApplication", "error", message)
            throw message
        }

        try {
            const result = await instanceManager.RunPackage({ packagePath, launchedBy: "my-desktop" })
            _RememberExecutable(executableName, packagePath)
            const instanceId = result && result.instanceId
            _Notify("Execution.RunApplication", "info", `Execução solicitada ao daemon: ${packagePath}`)
            return { started: true, packagePath, executableName, instanceId }
        } catch (e) {
            _Notify("Execution.RunApplication", "error", `Falha ao executar ${packagePath}: ${e.message || e}`)
            throw e
        }
    }

    // Lista as INSTÂNCIAS em execução no daemon que correspondem a aplicações
    // conhecidas por este painel. O daemon é a fonte da verdade: um mesmo
    // executável pode aparecer em várias instâncias, cada uma com seu instanceId.
    // Contrato: { running: [{ instanceId, executableName, packagePath, startedAt }] }.
    const ListRunning = async () => {
        let instanceList
        try {
            instanceList = await instanceManager.ListInstances()
        } catch (e) {
            return { running: [] }
        }

        const running = (instanceList || [])
            .map((instance) => {
                const executableName = pathToExecutable.get(instance.packagePath)
                if(!executableName) return undefined
                return {
                    instanceId: instance.instanceId,
                    executableName,
                    packagePath: instance.packagePath,
                    startedAt: instance.startedAt
                }
            })
            .filter(Boolean)

        return { running }
    }

    // Encerra TODAS as instâncias de uma aplicação pelo executableName (endpoint
    // de 1 parâmetro → valor posicional).
    const StopApplication = async (executableName) => {
        const packagePath = executableToPath.get(executableName)
        if(!packagePath)
            throw `Nenhuma instância em execução para "${executableName}".`

        try {
            const result = await instanceManager.StopPackage({ packagePath })
            _Notify("Execution.StopApplication", "info", `Encerramento solicitado ao daemon: ${executableName}`)
            return { stopped: true, executableName, ...result }
        } catch (e) {
            _Notify("Execution.StopApplication", "error", `Falha ao encerrar ${executableName}: ${e.message || e}`)
            throw e
        }
    }

    // Encerra UMA instância pelo seu id — é o que permite fechar a janela certa
    // quando a mesma aplicação está aberta várias vezes (endpoint de 1 parâmetro
    // → valor posicional).
    const StopInstance = async (instanceId) => {
        if(!instanceId) throw "É necessário informar a instância a encerrar."

        try {
            const result = await instanceManager.StopInstance({ instanceId })
            _Notify("Execution.StopInstance", "info", `Encerramento solicitado ao daemon: instância ${instanceId}`)
            return { stopped: true, instanceId, ...result }
        } catch (e) {
            _Notify("Execution.StopInstance", "error", `Falha ao encerrar a instância ${instanceId}: ${e.message || e}`)
            throw e
        }
    }

    // Ponte WebSocket: repassa o stream de progresso de lançamento do daemon
    // (abrindo → build → aberto) para o renderer/navegador. Só daemon→cliente.
    const BuildProgressStream = async (ws) => {
        const _safeSend = (payload) => {
            try { ws.send(typeof payload === "string" ? payload : JSON.stringify(payload)) } catch(e){}
        }

        let daemonWs
        try {
            daemonWs = await instanceManager.OpenLaunchProgressStream()
        } catch(error) {
            try { ws.close() } catch(e){}
            return
        }

        daemonWs.on("message", (data) => _safeSend(data.toString()))
        daemonWs.on("close",   () => { try { ws.close() } catch(e){} })
        daemonWs.on("error",   () => { try { ws.close() } catch(e){} })

        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e){} })
    }

    return {
        controllerName: "ExecutionController",
        RunApplication,
        ListRunning,
        StopApplication,
        StopInstance,
        BuildProgressStream
    }
}

module.exports = ExecutionController
