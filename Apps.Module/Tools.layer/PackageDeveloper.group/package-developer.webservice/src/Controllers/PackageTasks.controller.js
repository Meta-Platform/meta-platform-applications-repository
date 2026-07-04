const { promisify } = require("util")
const { exec } = require("child_process")
const { rm } = require("node:fs/promises")
const path = require("path")

const execAsync = promisify(exec)

const PackageTasksController = (params) => {

    const {
        packageHandlerManagerService,
        packageDeveloperLib,
        processManagerService
    } = params

    const GetPackage = packageDeveloperLib.require("Manager.Functions/GetPackage.function")
    const GetIcon    = packageDeveloperLib.require("Services/PackageHandler.service/PublicFunctions/GetIcon.function")

    // O front envia `type`, que corresponde ao `ext` do pacote.
    const _resolvePackage = ({packageName, type, workspace}) => {
        const pkg = GetPackage(packageHandlerManagerService, {packageName, workspace, ext: type})
        if(!pkg) throw `Pacote "${packageName}" (${type}) não encontrado na workspace "${workspace}"`
        return pkg
    }

    const _id = ({workspace, packageName, type}) => `${workspace}/${packageName}.${type}`

    const _InstallDependencies = async ({packageName, type, workspace}) => {
        const pkg = _resolvePackage({packageName, type, workspace})
        await execAsync("npm install", { cwd: pkg.path })
        return { message: "dependencies successfully installed" }
    }

    const _ClearDependencies = async ({packageName, type, workspace}) => {
        const pkg = _resolvePackage({packageName, type, workspace})
        await rm(path.resolve(pkg.path, "node_modules"), { recursive: true, force: true })
        return { message: "dependencies successfully cleared" }
    }

    const _Start = ({packageName, type, workspace}) => {
        const pkg = _resolvePackage({packageName, type, workspace})
        return processManagerService.StartPackage({
            id: _id({workspace, packageName, type}),
            packagePath: pkg.path
        })
    }

    const _Debug = ({packageName, type, workspace}) => {
        const pkg = _resolvePackage({packageName, type, workspace})
        return processManagerService.StartPackage({
            id: _id({workspace, packageName, type}),
            packagePath: pkg.path,
            debug: true
        })
    }

    const _Stop = ({packageName, type, workspace}) =>
        processManagerService.StopPackage(_id({workspace, packageName, type}))

    const _ListRunning = () => processManagerService.List()

    const _GetLogs = ({packageName, type, workspace}) =>
        ({ logs: processManagerService.GetLogs(_id({workspace, packageName, type})) })

    // Console WS: envia o buffer atual, faz streaming ao vivo e encaminha o
    // que o cliente digitar para o stdin do processo (terminal interativo).
    const _Console = (ws, {workspace, packageName, type}) => {
        const id = _id({workspace, packageName, type})

        const safeSend = (entry) => {
            try { ws.send(JSON.stringify(entry)) } catch(e) { /* socket fechado */ }
        }

        processManagerService.GetLogs(id).forEach(safeSend)
        const unsubscribe = processManagerService.Subscribe(id, safeSend)

        ws.on("message", (message) => {
            const data = message.toString()
            processManagerService.WriteToPackage(id, data.endsWith("\n") ? data : `${data}\n`)
        })
        ws.on("close", () => unsubscribe())
    }

    const _GetIcon = ({packageName, workspace, ext}) => {
        const packageDevelopmentService = GetPackage(packageHandlerManagerService, {packageName, workspace, ext})
        if(!packageDevelopmentService) return undefined
        return GetIcon(packageDevelopmentService.path)
    }

    const controllerServiceObject = {
        controllerName      : "PackageTasksController",
        InstallDependencies : _InstallDependencies,
        ClearDependencies   : _ClearDependencies,
        Start               : _Start,
        Debug               : _Debug,
        Stop                : _Stop,
        ListRunning         : _ListRunning,
        GetLogs             : _GetLogs,
        Console             : _Console,
        GetIcon             : _GetIcon
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = PackageTasksController
