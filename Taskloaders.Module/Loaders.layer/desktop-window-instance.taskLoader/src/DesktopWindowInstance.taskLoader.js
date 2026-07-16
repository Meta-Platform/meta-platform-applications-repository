const fs = require("fs")
const os = require("os")
const { join, basename } = require("path")

// Classe X11 (WM_CLASS) usada pelo gerenciador de janelas para agrupar botões na
// barra de tarefas. Cada .desktopapp precisa de uma classe ESTÁVEL e ÚNICA, senão
// o KDE agrupa todos os apps sob o mesmo botão. Preferimos o nome do app; para
// janelas url/file caímos no nome do diretório do pacote (rootPath) ou no título.
const _ResolveWmClass = (raw) => {
    const value = String(raw || "").trim()
    if(!value) return undefined
    // Mantém apenas caracteres seguros para um identificador de classe.
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    return sanitized || undefined
}

// TaskStatusTypes/CommandChannelEventTypes/OpenElectronWindow são resolvidos dentro da
// fábrica (deps injetadas pelo registry) — este loader vive em outro repo (applications).

// Ícone da janela: convenção de icon.svg na raiz do package (rootPath).
const ResolveIconPath = (rootPath) => {
    if(!rootPath) return undefined
    const candidate = join(rootPath, "icon.svg")
    return fs.existsSync(candidate) ? candidate : undefined
}

// Extrai os caminhos de um handle nodejs-package (resolvido de um bound-param).
const _HandlePaths = (handle) => ({
    src:         handle.getSourcePath(),
    nodeModules: handle.getNodeModulesPath()
})

// Modo GUI-host: a janela Electron NÃO carrega uma URL HTTP — o processo
// principal do Electron compila o webgui e hospeda os services por IPC. Como só
// strings cruzam o spawn, serializamos num JSON temporário (passado via
// DESKTOP_GUI_CONFIG_PATH):
//   - webgui: caminhos do pacote do webgui a compilar;
//   - serviceGraph: descrição GENÉRICA e declarativa (do spec "gui-host" do
//     boot.json) de como instanciar o grafo de services no Electron — cada
//     entrada aponta para um handle de pacote (bound-param), sua factory,
//     boundServices (refs a outras entradas) e boundLibs (handles de pacote);
//   - params: bag escalar comum passada a todas as factories.
// Isso NÃO é específico do my-desktop — funciona para qualquer .desktopapp que
// declare um "gui-host".
const _BuildGuiConfig = (loaderParams) => {
    const guiHost = loaderParams.guiHost
    const params  = loaderParams.guiParams || {}
    const webguiHandle = loaderParams[guiHost.webgui]

    const serviceGraph = (guiHost.serviceGraph || []).map((entry) => ({
        ref:            entry.ref,
        factory:        entry.factory,
        package:        _HandlePaths(loaderParams[entry.package]),
        boundServices:  entry.boundServices || {},
        boundLibs:      Object.keys(entry.boundLibs || {}).reduce((acc, paramName) => {
            acc[paramName] = _HandlePaths(loaderParams[entry.boundLibs[paramName]])
            return acc
        }, {})
    }))

    return {
        window: {
            title:    loaderParams.title,
            width:    loaderParams.width,
            height:   loaderParams.height,
            iconPath: ResolveIconPath(loaderParams.rootPath)
        },
        webgui: {
            context:                   webguiHandle.getSourcePath(),
            entrypoint:                "index.tsx",
            htmlTemplate:              "index.html",
            environmentPath:           webguiHandle.getEnvironmentPath(),
            nodeModules:               webguiHandle.getNodeModulesPath(),
            serverAppName:             params.serverName,
            RT_ENV_GENERATED_DIR_NAME: params.RT_ENV_GENERATED_DIR_NAME
        },
        params,
        guiServiceRef: guiHost.guiService,
        serviceGraph
    }
}

const _WriteGuiConfigFile = (config, serverName) => {
    const safeName = String(serverName || "gui").replace(/[^a-zA-Z0-9._-]/g, "_")
    const configPath = join(os.tmpdir(), `meta-gui-config-${safeName}-${process.pid}.json`)
    fs.writeFileSync(configPath, JSON.stringify(config), "utf8")
    return configPath
}

const DesktopWindowInstanceTaskLoader = (runtimeDeps) => {

  const { TaskStatusTypes, CommandChannelEventTypes } = runtimeDeps
  const OpenElectronWindow    = require("./OpenElectronWindow")(runtimeDeps)
  const EnsureAppDesktopEntry = require("./EnsureAppDesktopEntry")

  return (loaderParams, executorChannel) => {

    let windowProcess
    let wasStopped = false
    let isProcessExitScheduled = false

    const {
        url,
        file,
        rootPath,
        title,
        width,
        height,
        // Spec declarativo que marca o modo GUI-host. Quando presente, a janela
        // hospeda os services por IPC (no processo Electron) em vez de carregar
        // uma URL HTTP.
        guiHost
    } = loaderParams

    const isGuiHost = Boolean(guiHost)

    const ScheduleProcessExit = () => {
        if(isProcessExitScheduled) return
        isProcessExitScheduled = true
        setTimeout(() => process.exit(0), 100)
    }

    const Start = () => {
        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STARTING)
        try{
            if(isGuiHost){
                const config = _BuildGuiConfig(loaderParams)
                const guiConfigPath = _WriteGuiConfigFile(config, config.webgui.serverAppName)
                const wmClass = _ResolveWmClass(config.webgui.serverAppName)
                // Registra o app na barra de tarefas (StartupWMClass) para que o
                // KDE não agrupe todos os desktopapps pelo binário Electron comum.
                EnsureAppDesktopEntry({ wmClass, name: config.window.title, iconPath: config.window.iconPath })
                windowProcess = OpenElectronWindow({ guiConfigPath, wmClass })
            } else {
                const wmClass  = _ResolveWmClass(rootPath ? basename(rootPath) : title)
                const iconPath = ResolveIconPath(rootPath)
                EnsureAppDesktopEntry({ wmClass, name: title, iconPath })
                windowProcess = OpenElectronWindow({ url, file, rootPath, title, width, height, iconPath, wmClass })
            }

            windowProcess.on("exit", () => {
                windowProcess = undefined
                executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
                if(!wasStopped)
                    executorChannel.emit(CommandChannelEventTypes.STOP_ALL_TASKS)
                ScheduleProcessExit()
            })

            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
        }catch(e){
            console.error(e)
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.FAILURE)
        }
    }

    const Stop = () => {
        wasStopped = true
        executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.STOPPING)
        if(windowProcess){
            windowProcess.kill()
        } else {
            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
            ScheduleProcessExit()
        }
    }

    executorChannel.on(CommandChannelEventTypes.START_TASK, Start)
    executorChannel.on(CommandChannelEventTypes.STOP_TASK, Stop)

    return () => windowProcess
  }
}

module.exports = DesktopWindowInstanceTaskLoader
