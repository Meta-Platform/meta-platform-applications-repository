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

    // Mapa em memória do que ESTE painel iniciou nesta sessão: executableName ->
    // packagePath. Usado para casar o contrato do webgui (que fala em
    // executableName) com o daemon (que fala em packagePath).
    const startedByPanel = new Map()

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    // Caminhos dos pacotes atualmente em serviço no daemon.
    const _GetRunningPackagePaths = async () => {
        const supervised = await instanceManager.ListPackages()
        return new Set((supervised || [])
            .filter((p) => p && p.packageInService && p.applicationInServiceState)
            .map((p) => p.applicationInServiceState.staticParameters && p.applicationInServiceState.staticParameters.rootPath)
            .filter(Boolean))
    }

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
            await instanceManager.RunPackage({ packagePath })
            if(executableName) startedByPanel.set(executableName, packagePath)
            _Notify("Execution.RunApplication", "info", `Execução solicitada ao daemon: ${packagePath}`)
            return { started: true, packagePath, executableName }
        } catch (e) {
            _Notify("Execution.RunApplication", "error", `Falha ao executar ${packagePath}: ${e.message || e}`)
            throw e
        }
    }

    // Lista as aplicações iniciadas por este painel que ainda estão em serviço
    // no daemon. Mantém o contrato: { running: [{ executableName }] }.
    const ListRunning = async () => {
        let runningPaths
        try {
            runningPaths = await _GetRunningPackagePaths()
        } catch (e) {
            return { running: [] }
        }

        const running = []
        for(const [executableName, packagePath] of startedByPanel){
            if(runningPaths.has(packagePath))
                running.push({ executableName, packagePath })
            else
                startedByPanel.delete(executableName)
        }
        return { running }
    }

    // Encerra uma aplicação pelo executableName (endpoint de 1 parâmetro → valor
    // posicional). Delega o encerramento ao daemon via packagePath.
    const StopApplication = async (executableName) => {
        const packagePath = startedByPanel.get(executableName)
        if(!packagePath)
            throw `Nenhuma instância em execução para "${executableName}".`

        try {
            const result = await instanceManager.StopPackage({ packagePath })
            startedByPanel.delete(executableName)
            _Notify("Execution.StopApplication", "info", `Encerramento solicitado ao daemon: ${executableName}`)
            return { stopped: true, executableName, ...result }
        } catch (e) {
            _Notify("Execution.StopApplication", "error", `Falha ao encerrar ${executableName}: ${e.message || e}`)
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
        BuildProgressStream
    }
}

module.exports = ExecutionController
