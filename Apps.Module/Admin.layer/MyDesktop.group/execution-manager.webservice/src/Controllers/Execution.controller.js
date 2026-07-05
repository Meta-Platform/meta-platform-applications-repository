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

    const _Notify = (origin, type, message) =>
        NotifyEvent({ origin, type: "log", content: { sourceName: origin, type, message } })

    const _GetExecutablesDirPath = async () => {
        const ecosystemDefaults = await ReadJsonFile(
            path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaultsFileRelativePath))
        return path.resolve(ecosystemdataHandlerService.GetEcosystemDataPath(), ecosystemDefaults.ECOSYSTEMDATA_CONF_DIRNAME_GLOBAL_EXECUTABLES_DIR)
    }

    // Dispara um processo desacoplado (não bloqueia o servidor nem morre com ele).
    const _SpawnDetached = (command, args, options = {}) =>
        new Promise((resolve, reject) => {
            try {
                const child = spawn(command, args, { detached: true, stdio: "ignore", ...options })
                child.on("error", (err) => reject(err))
                setTimeout(() => { child.unref(); resolve() }, 150)
            } catch (e) {
                reject(e)
            }
        })

    // Lança uma aplicação de desktop instalada. O cliente envia a IDENTIDADE do
    // pacote (namespaceRepo/moduleName/layerName/packageName/ext/parentGroup) e o
    // caminho absoluto é resolvido aqui pelo repository-manager — o front nunca
    // manipula caminhos de sistema de arquivos.
    const RunApplication = async ({ namespaceRepo, moduleName, layerName, packageName, ext, parentGroup }) => {
        const packageData = { namespaceRepo, moduleName, layerName, packageName, ext, parentGroup }
        const packagePath = await repositoryManagerService.GetPackagePath(packageData)

        if(!packagePath){
            const message = `Pacote não encontrado: ${packageName}.${ext}`
            _Notify("Execution.RunApplication", "error", message)
            throw message
        }

        const executablesDirPath = await _GetExecutablesDirPath()
        const env = { ...process.env, PATH: `${executablesDirPath}:${process.env.PATH}` }
        try {
            await _SpawnDetached(path.resolve(executablesDirPath, "run"), ["package", packagePath], {
                cwd: ecosystemdataHandlerService.GetEcosystemDataPath(),
                env
            })
            _Notify("Execution.RunApplication", "info", `Iniciando aplicação: ${packagePath}`)
            return { started: true, packagePath }
        } catch (e) {
            _Notify("Execution.RunApplication", "error", `Falha ao iniciar ${packagePath}: ${e.message || e}`)
            throw e
        }
    }

    return {
        controllerName: "ExecutionController",
        RunApplication
    }
}

module.exports = ExecutionController
