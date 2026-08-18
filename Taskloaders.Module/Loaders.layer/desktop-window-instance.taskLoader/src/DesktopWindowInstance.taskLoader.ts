const fs = require("fs") as typeof import("fs")
const os = require("os") as typeof import("os")
const { join, basename } = require("path") as typeof import("path")
const { LooksLikeSandboxFailure, FormatSandboxWarning } = require("./SandboxSupport") as {
    LooksLikeSandboxFailure: (text: string) => boolean,
    FormatSandboxWarning: (state: any) => string
}

// Classe X11 (WM_CLASS) usada pelo gerenciador de janelas para agrupar botões na
// barra de tarefas. Cada .desktopapp precisa de uma classe ESTÁVEL e ÚNICA, senão
// o KDE agrupa todos os apps sob o mesmo botão. Preferimos o nome do app; para
// janelas url/file caímos no nome do diretório do pacote (rootPath) ou no título.
const _ResolveWmClass = (raw: any) => {
    const value = String(raw || "").trim()
    if(!value) return undefined
    // Mantém apenas caracteres seguros para um identificador de classe.
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    return sanitized || undefined
}

// TaskStatusTypes/CommandChannelEventTypes/OpenElectronWindow são resolvidos dentro da
// fábrica (deps injetadas pelo registry) — este loader vive em outro repo (applications).

// Código com que o processo da janela avisa "reabra-me" em vez de "terminei"
// (ver RESTART_EXIT_CODE no electron-main.js). É como a troca de placa de vídeo
// consegue um processo novo sem que a instância morra para o monitor.
const WINDOW_RESTART_EXIT_CODE = 87

// Ícone da janela: convenção de icon.svg na raiz do package (rootPath).
const ResolveIconPath = (rootPath?: string) => {
    if(!rootPath) return undefined
    const candidate = join(rootPath, "icon.svg")
    return fs.existsSync(candidate) ? candidate : undefined
}

// Extrai os caminhos de um handle nodejs-package (resolvido de um bound-param).
const _HandlePaths = (handle: any) => ({
    src:         handle.getSourcePath(),
    nodeModules: handle.getNodeModulesPath()
})

const _ComponentLibraryDescriptor = (alias: string, handle: any) => {
    const manifest = handle.getManifest()
    return {
        alias: alias || manifest.alias,
        sourcePath: handle.getSourcePath(),
        nodeModulesPath: handle.getNodeModulesPath(),
        // Só a biblioteca que instalou o runtime do framework responde. A guarda
        // cobre um ecosystem-core anterior a este recurso: sem o campo, o builder
        // cai no comportamento antigo (react do consumidor).
        frameworkModulesPath: handle.getFrameworkModulesPath && handle.getFrameworkModulesPath(),
        framework: manifest.framework
    }
}

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
const _BuildGuiConfig = (loaderParams: any) => {
    const guiHost = loaderParams.guiHost
    const params  = loaderParams.guiParams || {}
    const webguiHandle = loaderParams[guiHost.webgui]
    const componentLibraries = Object.keys(guiHost.componentLibraries || {}).map((alias: string) =>
        _ComponentLibraryDescriptor(alias, loaderParams[guiHost.componentLibraries[alias]])
    )

    const serviceGraph = (guiHost.serviceGraph || []).map((entry: any) => ({
        ref:            entry.ref,
        factory:        entry.factory,
        package:        _HandlePaths(loaderParams[entry.package]),
        boundServices:  entry.boundServices || {},
        boundLibs:      Object.keys(entry.boundLibs || {}).reduce((acc: Record<string, any>, paramName: string) => {
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
            RT_ENV_GENERATED_DIR_NAME: params.RT_ENV_GENERATED_DIR_NAME,
            // Perfil de build. `RT_WEBGUI_BUILD_PROFILE` chega do
            // ecosystem-defaults, que o gerador de parâmetros já injeta em
            // `guiParams` — nenhum .desktopapp precisa declarar nada para
            // herdar o padrão do ecossistema.
            buildProfile:              params.webguiBuildProfile || params.RT_WEBGUI_BUILD_PROFILE,
            componentLibraries
        },
        params,
        guiServiceRef: guiHost.guiService,
        serviceGraph
    }
}

// No modo GUI-host o ambiente não vem em loaderParams: quem o conhece é o
// handle do webgui. É de lá que sai o destino do log do processo Electron.
const _GetGuiHostEnvironmentPath = (loaderParams: any) => {
    try {
        const webguiHandle = loaderParams[loaderParams.guiHost.webgui]
        return webguiHandle && webguiHandle.getEnvironmentPath()
    } catch (error: any) {
        return null
    }
}

const _WriteGuiConfigFile = (config: any, serverName: any) => {
    const safeName = String(serverName || "gui").replace(/[^a-zA-Z0-9._-]/g, "_")
    const configPath = join(os.tmpdir(), `meta-gui-config-${safeName}-${process.pid}.json`)
    fs.writeFileSync(configPath, JSON.stringify(config), "utf8")
    return configPath
}

const DesktopWindowInstanceTaskLoader = (runtimeDeps: any) => {

  const { TaskStatusTypes, CommandChannelEventTypes } = runtimeDeps
  const OpenElectronWindow    = (require("./OpenElectronWindow") as (deps: any) => (options: any) => any)(runtimeDeps)
  const EnsureAppDesktopEntry = require("./EnsureAppDesktopEntry") as (entry: { wmClass?: string, name?: string, iconPath?: string }) => string | undefined

  return (loaderParams: any, executorChannel: any) => {

    // Carimba a execução — ver logging-standard.md.
    const log = Log
        .child({
            instanceId     : process.env.META_LAUNCH_ID || null,
            environmentPath: loaderParams.environmentPath || null
        })
        .source("DesktopWindowInstance")

    // O log do processo do Electron mora no logs/ do ambiente daquela execução.
    const _ResolveLogsDirPath = () => {
        const environmentPath = loaderParams.environmentPath
            || (loaderParams.guiHost && _GetGuiHostEnvironmentPath(loaderParams))
        return environmentPath ? join(environmentPath, "logs") : null
    }

    let windowProcess: any
    let wasStopped = false
    let isProcessExitScheduled = false
    // A reabertura sem sandbox acontece UMA vez: se a janela morrer de novo, o
    // problema é outro e insistir só esconderia o motivo real.
    let sandboxFallbackAttempted = false
    // Reabertura pedida pela própria janela (ver RESTART_EXIT_CODE no
    // electron-main): trocar a placa de vídeo exige um processo Electron novo,
    // porque a escolha é uma flag lida na largada. Reabrimos aqui em vez de
    // deixar o Electron se relançar sozinho — assim a INSTÂNCIA continua sendo
    // esta, e o app não some do monitor de execução.
    let openWindow: (options?: any) => void

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

    // Como a janela abriu, em uma linha — e o aviso inteiro quando ela abriu
    // desprotegida. É o mesmo texto que a janela mostra à pessoa; aqui ele
    // serve a quem lê o log da instância depois.
    const _AnnounceSandboxMode = () => {
        const sandbox = windowProcess && windowProcess.metaSandbox
        if(!sandbox) return
        if(sandbox.mode === "disabled")
            log.warn(FormatSandboxWarning(sandbox))
        else
            log.info(`sandbox do Chromium ativa (${sandbox.reason})`)
    }

    const ScheduleProcessExit = () => {
        if(isProcessExitScheduled) return
        isProcessExitScheduled = true
        setTimeout(() => process.exit(0), 100)
    }

    const _WatchWindowProcess = () => {
        // O processo observado fica preso aqui porque `windowProcess` é zerado
        // logo abaixo — e o que ele disse antes de morrer só existe nele.
        const watchedProcess = windowProcess
        windowProcess.on("exit", (code: number | null, signal: string | null) => {
            const stderrTail  = watchedProcess.metaStderrTail ? watchedProcess.metaStderrTail() : ""
            const sandboxMode = watchedProcess.metaSandbox ? watchedProcess.metaSandbox.mode : null
            windowProcess = undefined
            // Por que a janela terminou: sem isto, o monitor de instâncias
            // mostra "encerrada" sem motivo nenhum.
            log.info(`a janela terminou (código=${code}, sinal=${signal})`)

            // A janela pediu para ser reaberta (troca de placa de vídeo). Não é
            // fim de execução: a instância segue viva e ganha uma janela nova.
            if(code === WINDOW_RESTART_EXIT_CODE && !wasStopped){
                log.info("a janela pediu reabertura — abrindo de novo")
                openWindow()
                _WatchWindowProcess()
                return
            }

            // REDE DE SEGURANÇA DA SANDBOX. O Chromium aborta ANTES de existir
            // janela quando a máquina não permite nenhum modo de isolamento, e
            // o motivo existe só no stderr. A leitura do /proc feita na
            // abertura conhece os mecanismos das distros que conhecemos; o que
            // ela não previr cai aqui — reconhecemos o abort pelo que ele
            // disse e reabrimos sem sandbox, avisando. É esta segunda camada
            // que faz a janela abrir em sistema nenhum de nós já testou.
            if(!wasStopped && !sandboxFallbackAttempted && sandboxMode !== "disabled" && LooksLikeSandboxFailure(stderrTail)){
                sandboxFallbackAttempted = true
                log.warn("o Chromium não conseguiu iniciar a sandbox nesta máquina — reabrindo a janela sem sandbox")
                openWindow({ forceNoSandbox: true })
                _AnnounceSandboxMode()
                _WatchWindowProcess()
                return
            }

            // Saída anormal: o que o processo escreveu antes de morrer é a
            // única pista que existe. Sem isto o monitor mostra "encerrada" e
            // mais nada — foi assim que um abort de sandbox passou por bug do
            // app durante horas.
            if(!wasStopped && code !== 0 && stderrTail)
                log.error(`saída do processo da janela antes de terminar:\n${stderrTail}`)

            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.TERMINATED)
            if(!wasStopped)
                executorChannel.emit(CommandChannelEventTypes.STOP_ALL_TASKS)
            ScheduleProcessExit()
        })
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
                openWindow = (options?: any) => { windowProcess = OpenElectronWindow({ guiConfigPath, wmClass, logsDirPath: _ResolveLogsDirPath(), ...options }) }
            } else {
                const wmClass  = _ResolveWmClass(rootPath ? basename(rootPath) : title)
                const iconPath = ResolveIconPath(rootPath)
                EnsureAppDesktopEntry({ wmClass, name: title, iconPath })
                openWindow = (options?: any) => { windowProcess = OpenElectronWindow({ url, file, rootPath, title, width, height, iconPath, wmClass, logsDirPath: _ResolveLogsDirPath(), ...options }) }
            }

            openWindow()
            _AnnounceSandboxMode()
            _WatchWindowProcess()

            executorChannel.emit(CommandChannelEventTypes.CHANGE_TASK_STATUS, TaskStatusTypes.ACTIVE)
        }catch(e: any){
            log.error("falha ao abrir a janela", e)
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
