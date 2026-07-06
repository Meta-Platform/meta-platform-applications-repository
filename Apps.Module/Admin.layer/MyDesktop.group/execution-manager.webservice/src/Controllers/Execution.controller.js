const path = require("path")
const { spawn } = require("node:child_process")

const ExecutionController = (params) => {

    const {
        ecosystemdataHandlerService,
        ecosystemDefaultsFileRelativePath,
        jsonFileUtilitiesLib,
        repositoryManagerService,
        notificationHubService
    } = params

    const ReadJsonFile = jsonFileUtilitiesLib.require("ReadJsonFile")
    const { NotifyEvent } = notificationHubService

    // Registro em memória das instâncias iniciadas pelo MyDesktop nesta sessão.
    // Chave = executableName (ou o packagePath, se o executável não for informado).
    // Guardamos o processo `run` (que hospeda/supervisiona a instância) para
    // saber o que está em execução e poder encerrá-lo depois.
    const runningRegistry = new Map()

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    const _GetExecutablesDirPath = async () => {
        const ecosystemDefaults = await ReadJsonFile(
            path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath))
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR)
    }

    const _IsAlive = (pid) => {
        try { process.kill(pid, 0); return true } catch(e) { return false }
    }

    // Lança uma aplicação de desktop instalada. Recebe a IDENTIDADE do pacote
    // (namespaceRepo/moduleName/...) — o caminho absoluto é resolvido aqui pelo
    // repository-manager. `executableName` (opcional) é usado como chave de
    // rastreio das instâncias em execução.
    const RunApplication = async ({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup, executableName }) => {
        const packageData = { namespaceRepo, moduleName, layerName, packageName, ext, parentGroup }
        const packagePath = await repositoryManagerService.GetPackagePath(packageData)

        if(!packagePath){
            const message = `Pacote não encontrado: ${packageName}.${ext}`
            _Notify("Execution.RunApplication", "error", message)
            throw message
        }

        const registryKey = executableName || packagePath
        const executablesDirPath = await _GetExecutablesDirPath()
        const env = { ...process.env, PATH: `${executablesDirPath}:${process.env.PATH}` }

        try {
            // detached: cria um novo GRUPO de processos (pgid = pid) para podermos
            // encerrar a árvore inteira depois com process.kill(-pid).
            const child = spawn(path.resolve(executablesDirPath, "run"), ["package", packagePath], {
                cwd: ecosystemdataHandlerService.GetEcosystemDataPath(),
                env,
                detached: true,
                stdio: "ignore"
            })

            runningRegistry.set(registryKey, { executableName: registryKey, pid: child.pid, packagePath, startedAt: Date.now(), child })
            child.on("exit", () => {
                const entry = runningRegistry.get(registryKey)
                if(entry && entry.pid === child.pid) runningRegistry.delete(registryKey)
            })
            child.unref()

            _Notify("Execution.RunApplication", "info", `Iniciando aplicação: ${packagePath} (pid ${child.pid})`)
            return { started: true, packagePath, pid: child.pid, executableName: registryKey }
        } catch (e) {
            _Notify("Execution.RunApplication", "error", `Falha ao iniciar ${packagePath}: ${e.message || e}`)
            throw e
        }
    }

    // Lista as instâncias iniciadas pelo MyDesktop que ainda estão vivas.
    const ListRunning = async () => {
        const running = []
        for(const [key, entry] of runningRegistry) {
            if(_IsAlive(entry.pid)) {
                running.push({ executableName: entry.executableName, pid: entry.pid, packagePath: entry.packagePath, startedAt: entry.startedAt })
            } else {
                runningRegistry.delete(key)
            }
        }
        return { running }
    }

    // Encerra uma instância iniciada pelo MyDesktop (mata o grupo de processos).
    // Endpoint de 1 parâmetro → recebe o VALOR posicional (contrato do servidor).
    const StopApplication = async (executableName) => {
        const entry = runningRegistry.get(executableName)
        if(!entry)
            throw `Nenhuma instância em execução para "${executableName}".`

        try {
            // sinal para o GRUPO (pgid negativo) → encerra a árvore (run + app)
            try { process.kill(-entry.pid, "SIGTERM") } catch(e) { process.kill(entry.pid, "SIGTERM") }
            runningRegistry.delete(executableName)
            _Notify("Execution.StopApplication", "info", `Instância encerrada: ${executableName} (pid ${entry.pid})`)
            return { stopped: true, executableName }
        } catch (e) {
            _Notify("Execution.StopApplication", "error", `Falha ao encerrar ${executableName}: ${e.message || e}`)
            throw e
        }
    }

    return {
        controllerName: "ExecutionController",
        RunApplication,
        ListRunning,
        StopApplication
    }
}

module.exports = ExecutionController
