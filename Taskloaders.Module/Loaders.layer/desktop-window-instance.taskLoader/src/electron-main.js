const { app, BrowserWindow, Menu, dialog, ipcMain, Notification, nativeImage, protocol, net } = require("electron")
const http  = require("http")
const https = require("https")
const crypto = require("crypto")
const fs = require("fs")
const { join } = require("path")
const { pathToFileURL } = require("url")

const DEFAULT_WIDTH  = 1024
const DEFAULT_HEIGHT = 768
const POLL_INTERVAL_MS   = 800
const REQUEST_TIMEOUT_MS = 2000
const ASSET_POLL_INTERVAL_MS = 1200

const LOADING_PAGE = join(__dirname, "loading.html")
const PRELOAD_SCRIPT = join(__dirname, "preload.js")

// Modo GUI-host: quando o host passa DESKTOP_GUI_CONFIG_PATH, este processo
// compila o webgui e hospeda os services por IPC (sem HTTP/webservices). O
// scheme dos ícones precisa ser declarado privilegiado ANTES do app ficar
// pronto — só registramos no modo GUI-host para não afetar apps legados.
const IS_GUI_HOST = Boolean(process.env.DESKTOP_GUI_CONFIG_PATH)
if(IS_GUI_HOST){
    protocol.registerSchemesAsPrivileged([
        { scheme: "metaicon", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
    ])
}

// Identidade de janela para o gerenciador de janelas (X11 WM_CLASS). Sem isto,
// TODOS os .desktopapp compartilham a mesma classe (o binário Electron) e o KDE
// (e afins) os agrupa num único botão da barra de tarefas. Damos a cada app uma
// classe própria (o nome do app) — precisa ser definida ANTES de o app ficar
// pronto/criar a janela. Usamos os dois caminhos: `--class` (lido pelo Chromium
// no X11) e `app.setName` (usado pelo Electron como fallback do WM_CLASS).
const WM_CLASS = process.env.DESKTOP_WINDOW_WM_CLASS
if(WM_CLASS){
    app.commandLine.appendSwitch("class", WM_CLASS)
    app.setName(WM_CLASS)
}

// Reporta o progresso de LANÇAMENTO ao daemon (executor-manager) que abriu esta
// janela. O daemon injeta META_LAUNCH_PROGRESS_SOCKET/META_LAUNCH_ID no env; aqui
// POSTamos o ciclo (window-ready → building → ready) no socket dele, e a área de
// trabalho (MyDesktop) reflete no ícone. Best-effort: se o daemon não estiver
// ouvindo, a falha é ignorada e o app segue normalmente.
// Depois do "ready", o webpack ainda pode disparar onChangeProgress(100) uma
// última vez; sem esta trava, esse "building 100" chegaria DEPOIS do "ready" e
// faria a barra reaparecer no ícone. Uma vez pronto, só "closed" (fim do app)
// volta a ser reportado.
let _launchProgressDone = false
const _ReportLaunchProgress = (phase, percentage) => {
    const socketPath = process.env.META_LAUNCH_PROGRESS_SOCKET
    const launchId   = process.env.META_LAUNCH_ID
    if(!socketPath || !launchId) return
    if(_launchProgressDone && (phase === "building" || phase === "window-ready")) return
    if(phase === "ready") _launchProgressDone = true
    try {
        const body = JSON.stringify({ launchId, phase, ...(percentage !== undefined ? { percentage } : {}) })
        const req = http.request({
            socketPath,
            path: "/ecosystem-manager/report-launch-progress",
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
        })
        req.on("error", () => {})
        req.end(body)
    } catch(e){}
}

const ResolveUrl = (baseUrl, path) => {
    try {
        return new URL(path, baseUrl).toString()
    } catch(e) {
        return undefined
    }
}

const Fetch = (targetUrl) => new Promise((resolve) => {
    let settled = false
    const done = (value) => { if(!settled){ settled = true; resolve(value) } }
    const lib = targetUrl.startsWith("https") ? https : http
    try {
        const request = lib.get(targetUrl, (response) => {
            const chunks = []
            response.on("data", (chunk) => chunks.push(chunk))
            response.on("end", () => done({
                statusCode: response.statusCode,
                body: Buffer.concat(chunks)
            }))
        })
        request.on("error", () => done(undefined))
        request.setTimeout(REQUEST_TIMEOUT_MS, () => { request.destroy(); done(undefined) })
    } catch(e) {
        done(undefined)
    }
})

// Verifica se a aplicação web local já está sendo servida (HTTP 200). Enquanto o
// webgui ainda está compilando (webpack em runtime), a rota "/" responde != 200.
const IsServerReady = async (targetUrl) => {
    const response = await Fetch(targetUrl)
    return Boolean(response && response.statusCode === 200)
}

const GetBundleSignature = async (targetUrl) => {
    const bundleUrl = ResolveUrl(targetUrl, "bundle.js")
    if(!bundleUrl) return undefined

    const response = await Fetch(bundleUrl)
    if(!response || response.statusCode !== 200 || !response.body) return undefined

    return crypto.createHash("sha1").update(response.body).digest("hex")
}

// O Electron/nativeImage não suporta SVG. Como os pacotes só têm icon.svg, aqui
// rasterizamos o SVG para PNG em runtime usando uma janela oculta do próprio
// Electron (Chromium): desenha o SVG num <canvas> e exporta PNG. Sem dependência
// externa. Retorna um nativeImage (ou undefined em falha).
const RasterizeSvgToPng = async (svgPath, size = 256) => {
    let svgContent
    try {
        svgContent = fs.readFileSync(svgPath, "utf8")
    } catch(e) {
        return undefined
    }
    // data URL do SVG (mesma origem → não "tainta" o canvas ao exportar PNG)
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`

    // janela OCULTA (não offscreen) — mais confiável para rodar canvas/Image
    const hidden = new BrowserWindow({
        show: false,
        width: size,
        height: size,
        webPreferences: {}
    })

    // nunca deixa uma etapa travar para sempre
    const withTimeout = (promise, ms) => Promise.race([
        Promise.resolve(promise).catch(() => undefined),
        new Promise((resolve) => setTimeout(() => resolve(undefined), ms))
    ])

    try {
        await withTimeout(hidden.loadURL("data:text/html;charset=utf-8,<html><body></body></html>"), 4000)
        const pngDataUrl = await withTimeout(hidden.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const img = new Image()
                img.onload = () => {
                    try {
                        const canvas = document.createElement("canvas")
                        canvas.width = ${size}; canvas.height = ${size}
                        const ctx = canvas.getContext("2d")
                        ctx.clearRect(0, 0, ${size}, ${size})
                        ctx.drawImage(img, 0, 0, ${size}, ${size})
                        resolve(canvas.toDataURL("image/png"))
                    } catch(e) { resolve(null) }
                }
                img.onerror = () => resolve(null)
                img.src = ${JSON.stringify(svgDataUrl)}
            })
        `, true), 5000)

        if(!pngDataUrl) return undefined
        const image = nativeImage.createFromDataURL(pngDataUrl)
        return image.isEmpty() ? undefined : image
    } catch(e) {
        return undefined
    } finally {
        if(!hidden.isDestroyed()) hidden.destroy()
    }
}

// Aplica o ícone do pacote SEM bloquear a abertura da janela: rasteriza em
// segundo plano e faz setIcon quando pronto. Se falhar/demorar, a janela abre
// normalmente (só sem ícone customizado).
const ApplyPackageIcon = (window, iconPath) => {
    if(!iconPath) return
    RasterizeSvgToPng(iconPath)
        .then((image) => { if(image && !window.isDestroyed()) window.setIcon(image) })
        .catch(() => {})
}

const CreateWindow = () => {

    // Sem menu (não é uma aplicação de desenvolvimento).
    Menu.setApplicationMenu(null)

    const iconPath = process.env.DESKTOP_WINDOW_ICON && fs.existsSync(process.env.DESKTOP_WINDOW_ICON)
        ? process.env.DESKTOP_WINDOW_ICON
        : undefined

    const window = new BrowserWindow({
        ...process.env.DESKTOP_WINDOW_TITLE ? { title: process.env.DESKTOP_WINDOW_TITLE } : {},
        width:  process.env.DESKTOP_WINDOW_WIDTH  ? Number(process.env.DESKTOP_WINDOW_WIDTH)  : DEFAULT_WIDTH,
        height: process.env.DESKTOP_WINDOW_HEIGHT ? Number(process.env.DESKTOP_WINDOW_HEIGHT) : DEFAULT_HEIGHT,
        autoHideMenuBar: true,
        webPreferences: {
            preload: PRELOAD_SCRIPT,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    // Esta task loader cria uma única janela. Ao fechar essa janela, encerra o
    // processo Electron inteiro para não deixar renderer/GPU/network órfãos.
    window.on("closed", () => app.exit(0))

    // Ícone do pacote aplicado em 2º plano (NÃO bloqueia a abertura da janela).
    ApplyPackageIcon(window, iconPath)

    // Janela criada → o ícone do MyDesktop deixa o spinner.
    _ReportLaunchProgress("window-ready")

    const url  = process.env.DESKTOP_WINDOW_URL
    const file = process.env.DESKTOP_WINDOW_FILE

    // Modo loadFile: conteúdo estático local, sem espera. "ready" só quando o
    // conteúdo REAL terminar de renderizar (did-finish-load) — não antes de
    // sequer disparar o load —, para o ícone do MyDesktop só marcar "aberto"
    // (badge verde) com a UI de fato pronta.
    if(!url) {
        window.webContents.once("did-finish-load", () => _ReportLaunchProgress("ready", 100))
        window.loadFile(file)
        return
    }

    // Modo loadURL: mostra a página provisória e faz polling até o front-end
    // buildado responder; então troca para ele.
    let loaded = false
    let readyReported = false
    let currentBundleSignature
    let ignoredBundleSignature
    let promptOpen = false

    // Durante o carregamento, mantém o título correto do app (não deixa a página
    // provisória exibir "Carregando…"). Depois que o front-end real carrega, ele
    // pode definir o próprio título.
    const title = process.env.DESKTOP_WINDOW_TITLE
    window.on("page-title-updated", (event) => { if(!loaded) event.preventDefault() })
    if(title) window.setTitle(title)

    const PollUntilReady = async () => {
        if(loaded || window.isDestroyed()) return
        if(await IsServerReady(url)) {
            loaded = true
            currentBundleSignature = await GetBundleSignature(url)
            // "ready" NÃO é reportado aqui: servidor respondendo 200 não é o
            // mesmo que a UI renderizada. Quem reporta é o did-finish-load do
            // front-end real (handler abaixo).
            if(!window.isDestroyed()) window.loadURL(url)
            setTimeout(PollForUpdatedBundle, ASSET_POLL_INTERVAL_MS)
        } else {
            setTimeout(PollUntilReady, POLL_INTERVAL_MS)
        }
    }

    const ConfirmReload = async (newBundleSignature) => {
        if(promptOpen || window.isDestroyed()) return
        promptOpen = true

        const result = await dialog.showMessageBox(window, {
            type: "question",
            buttons: ["Recarregar agora", "Manter tela atual"],
            defaultId: 0,
            cancelId: 1,
            title: "Interface atualizada",
            message: "A interface nova terminou de carregar.",
            detail: "Para aplicar a versão atualizada, a janela precisa recarregar. Deseja recarregar agora?"
        })

        promptOpen = false

        if(window.isDestroyed()) return
        if(result.response === 0) {
            currentBundleSignature = newBundleSignature
            window.loadURL(url)
        } else {
            ignoredBundleSignature = newBundleSignature
        }
    }

    const PollForUpdatedBundle = async () => {
        if(!loaded || window.isDestroyed()) return

        const newBundleSignature = await GetBundleSignature(url)
        if(!currentBundleSignature && newBundleSignature)
            currentBundleSignature = newBundleSignature
        else if(
            newBundleSignature &&
            currentBundleSignature &&
            newBundleSignature !== currentBundleSignature &&
            newBundleSignature !== ignoredBundleSignature
        ) {
            await ConfirmReload(newBundleSignature)
        }

        if(!window.isDestroyed())
            setTimeout(PollForUpdatedBundle, ASSET_POLL_INTERVAL_MS)
    }

    // "ready" só quando a UI REAL terminar de carregar. O did-finish-load também
    // dispara para a página provisória (loading.html) e para recarregamentos de
    // bundle; a trava loaded/readyReported garante um único "ready", no instante
    // em que o front-end buildado de fato renderizou (e não quando o servidor
    // apenas respondeu 200).
    window.webContents.on("did-finish-load", () => {
        if(loaded && !readyReported){
            readyReported = true
            _ReportLaunchProgress("ready", 100)
        }
    })

    // Se o front-end buildado falhar ao carregar, volta para a provisória e
    // continua tentando.
    window.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if(isMainFrame && loaded && !window.isDestroyed()) {
            loaded = false
            currentBundleSignature = undefined
            ignoredBundleSignature = undefined
            window.loadFile(LOADING_PAGE)
            if(title) window.setTitle(title)
            setTimeout(PollUntilReady, POLL_INTERVAL_MS)
        }
    })

    window.loadFile(LOADING_PAGE)
    PollUntilReady()
}

ipcMain.handle("desktop-notification:show", async (event, { title, body } = {}) => {
    if(Notification.isSupported() && title) {
        new Notification({
            title: String(title),
            body: body ? String(body) : undefined
        }).show()
    }
})

// ======================================================================
// Modo GUI-host: hospeda os services + o build do webgui neste processo.
// ======================================================================

// Handle de pacote no estilo do nodejs-package (SetupServiceObject): requer
// módulos do pacote com o NODE_PATH apontando para o node_modules dele, para
// que os require internos resolvam. src já é o diretório "src" do pacote.
const CreatePackageHandle = (src, nodeModules) => ({
    require: (subPath) => {
        const scriptPath = join(src, subPath)
        const originalNodePath = process.env.NODE_PATH
        process.env.NODE_PATH = nodeModules || ""
        require("module").Module._initPaths()
        const mod = require(scriptPath)
        process.env.NODE_PATH = originalNodePath || ""
        require("module").Module._initPaths()
        return mod
    },
    getSourcePath: () => src,
    getNodeModulesPath: () => nodeModules
})

// Instancia o grafo de services que a GUI precisa (equivalente ao que o
// service-instance loader + bound-params fazem no host, mas neste processo).
// GENÉRICO: percorre config.serviceGraph (declarado no "gui-host" do boot.json,
// já ordenado por dependência), instanciando cada factory com:
//   - config.params  (bag escalar comum; cada factory destrutura o que usa)
//   - boundServices  (refs a services já instanciados nesta iteração)
//   - boundLibs      (handles de pacote reconstruídos dos caminhos)
// Reusa a LÓGICA real de cada service/controller. onReady/onClose são no-ops
// (não há executor aqui). Retorna o service marcado como guiServiceRef, que
// expõe Invoke/GetManifest/GetIcon ao renderer.
const BootstrapGuiServices = (config) => {
    const noop = () => {}
    const instances = {}

    for(const entry of config.serviceGraph){
        const Factory = CreatePackageHandle(entry.package.src, entry.package.nodeModules).require(entry.factory)

        const boundServices = Object.keys(entry.boundServices || {}).reduce((acc, paramName) => {
            acc[paramName] = instances[entry.boundServices[paramName]]
            return acc
        }, {})

        const boundLibs = Object.keys(entry.boundLibs || {}).reduce((acc, paramName) => {
            const lib = entry.boundLibs[paramName]
            acc[paramName] = CreatePackageHandle(lib.src, lib.nodeModules)
            return acc
        }, {})

        instances[entry.ref] = Factory({
            ...config.params,
            ...boundServices,
            ...boundLibs,
            onReady: noop,
            onClose: noop
        })
    }

    return instances[config.guiServiceRef]
}

// Diretório de saída do build do webgui (independente do caminho HTTP).
const MountGuiOutputDir = (webgui) =>
    join(webgui.environmentPath, webgui.RT_ENV_GENERATED_DIR_NAME, `${webgui.serverAppName}.webInterfaceAssets`)

const CreateGuiHostWindow = async () => {

    Menu.setApplicationMenu(null)

    let config
    try {
        config = JSON.parse(fs.readFileSync(process.env.DESKTOP_GUI_CONFIG_PATH, "utf8"))
    } catch(e) {
        console.error("Falha ao ler DESKTOP_GUI_CONFIG_PATH:", e)
        app.exit(1)
        return
    }

    const iconPath = config.window.iconPath && fs.existsSync(config.window.iconPath)
        ? config.window.iconPath
        : undefined

    const window = new BrowserWindow({
        ...config.window.title ? { title: config.window.title } : {},
        width:  config.window.width  ? Number(config.window.width)  : DEFAULT_WIDTH,
        height: config.window.height ? Number(config.window.height) : DEFAULT_HEIGHT,
        autoHideMenuBar: true,
        webPreferences: {
            preload: PRELOAD_SCRIPT,
            contextIsolation: true,
            nodeIntegration: false
        }
    })
    window.on("closed", () => app.exit(0))
    ApplyPackageIcon(window, iconPath)

    // Janela criada (tela de carregamento visível) → o ícone do MyDesktop deixa
    // o spinner e passa a exibir o progresso do build.
    _ReportLaunchProgress("window-ready")

    // Durante o build, preserva o título do app (não deixa a página provisória
    // renomear a janela). Depois que o webgui carrega, ele define o próprio.
    const title = config.window.title
    let loaded = false
    window.on("page-title-updated", (event) => { if(!loaded) event.preventDefault() })
    if(title) window.setTitle(title)

    window.loadFile(LOADING_PAGE)

    // Services hospedados neste processo, expostos ao renderer por IPC.
    let guiServices
    try {
        guiServices = BootstrapGuiServices(config)
    } catch(e) {
        console.error("Falha ao inicializar os services de GUI:", e)
    }

    ipcMain.handle("metaGui:invoke", async (_event, { serviceName, method, args } = {}) => {
        if(!guiServices) throw new Error("Serviços de GUI indisponíveis")
        return guiServices.Invoke(serviceName, method, args)
    })
    ipcMain.handle("metaGui:manifest", async () => guiServices ? guiServices.GetManifest() : {})

    // Canal de streaming (equivalente a WebSocket). Para cada stream aberto pelo
    // renderer, cria um objeto ws-like (wsShim) com a MESMA API que os controllers
    // esperam do `ws` do express-ws (send / on("close") / on("message") / close /
    // readyState) e o entrega ao guiServices.InvokeStream, que chama o método WS
    // do controller. Os eventos voltam ao renderer por "metaGui:stream:event".
    const streams = {}
    const _StreamSend = (sender, streamId, type, data) => {
        if(!sender.isDestroyed())
            sender.send("metaGui:stream:event", { streamId, type, ...(data !== undefined ? { data } : {}) })
    }
    ipcMain.on("metaGui:stream:open", (event, { streamId, serviceName, method, args } = {}) => {
        if(!guiServices || typeof guiServices.InvokeStream !== "function"){
            _StreamSend(event.sender, streamId, "error")
            return
        }
        const messageCbs = []
        const closeCbs = []
        let closed = false
        const wsShim = {
            readyState: 1,
            send: (payload) => _StreamSend(event.sender, streamId, "message", typeof payload === "string" ? payload : JSON.stringify(payload)),
            close: () => {
                if(closed) return
                closed = true
                wsShim.readyState = 3
                closeCbs.forEach((cb) => { try { cb() } catch(e){} })
                _StreamSend(event.sender, streamId, "close")
                delete streams[streamId]
            },
            on: (eventName, cb) => {
                if(eventName === "close")   closeCbs.push(cb)
                if(eventName === "message") messageCbs.push(cb)
            },
            _messageCbs: messageCbs,
            _closeCbs: closeCbs
        }
        streams[streamId] = wsShim
        _StreamSend(event.sender, streamId, "open")
        try {
            guiServices.InvokeStream(serviceName, method, args, wsShim)
        } catch(e) {
            console.error("Falha ao abrir stream", serviceName, method, e)
            _StreamSend(event.sender, streamId, "error")
        }
    })
    ipcMain.on("metaGui:stream:send", (_event, { streamId, data } = {}) => {
        const wsShim = streams[streamId]
        if(wsShim) wsShim._messageCbs.forEach((cb) => { try { cb(data) } catch(e){} })
    })
    ipcMain.on("metaGui:stream:close-request", (_event, { streamId } = {}) => {
        const wsShim = streams[streamId]
        if(wsShim){
            wsShim._closeCbs.forEach((cb) => { try { cb() } catch(e){} })
            delete streams[streamId]
        }
    })

    // Protocolo de ícones: substitui as URLs http:// de ícone. O <img src> do
    // webgui aponta para metaicon://<kind>?<params>; aqui resolvemos o caminho
    // de arquivo via o service e servimos o arquivo (com cache do Chromium).
    protocol.handle("metaicon", async (request) => {
        try {
            const parsed = new URL(request.url)
            const kind = parsed.hostname
            const args = Object.fromEntries(parsed.searchParams.entries())
            const iconFilePath = guiServices && await guiServices.GetIcon({ kind, args })
            if(!iconFilePath)
                return new Response("not found", { status: 404 })
            return net.fetch(pathToFileURL(iconFilePath).toString())
        } catch(e) {
            return new Response("error", { status: 500 })
        }
    })

    // Carrega o webgui no bundle local (loadFile — sem servidor HTTP). Se o
    // front-end já foi montado e nada mudou desde então, reaproveita o bundle
    // direto; caso contrário (primeira vez ou pacote/repositório atualizado)
    // compila com webpack empurrando o progresso para a tela de carregamento.
    const _LoadBundle = (output) => {
        if(window.isDestroyed()) return
        if(!window.webContents.isDestroyed())
            window.webContents.send("build:progress", 100)
        loaded = true
        // "ready" só quando o index.html buildado terminar de renderizar
        // (did-finish-load), não quando o webpack apenas concluiu o build. A
        // página provisória já carregou muito antes, durante o build, então
        // o próximo did-finish-load é o da UI real.
        window.webContents.once("did-finish-load", () => _ReportLaunchProgress("ready", 100))
        window.loadFile(join(output, "index.html"))
    }

    try {
        // Subprocesso Electron: resolve o WebInterfaceBuilder (ecosystem-core) e o
        // SmartRequire (essential) pelos PATHS injetados no env pelo OpenElectronWindow.
        // A lib é uma fábrica que recebe o SmartRequire.
        const WebInterfaceBuilder = require(process.env.META_WEB_INTERFACE_BUILDER_PATH)(require(process.env.META_SMART_REQUIRE_PATH))
        const BuildCache = require("./BuildCache")
        const output = MountGuiOutputDir(config.webgui)

        // Assinatura de conteúdo das entradas do build (fonte do webgui +
        // node_modules). Se bate com a do último build e os artefatos existem,
        // pula o webpack e carrega o bundle já montado — sem barra de build.
        let fingerprint
        try {
            fingerprint = BuildCache.ComputeWebInterfaceFingerprint({
                context:     config.webgui.context,
                nodeModules: config.webgui.nodeModules
            })
        } catch(e) {
            fingerprint = null
        }

        if(BuildCache.IsWebInterfaceFresh({ output, fingerprint })){
            // Front-end já montado e sem atualização: carrega direto.
            console.log(`[webgui] bundle atualizado — reaproveitando (sem build): ${output}`)
            _LoadBundle(output)
        } else {
            console.log(`[webgui] montando front-end (build necessário): ${config.webgui.serverAppName}`)
            // Primeira vez ou entradas alteradas: builda com webpack. Reporta o
            // progresso ao daemon apenas quando o inteiro muda, para não inundar
            // o socket com frações intermediárias.
            let lastReportedPct = -1
            const builder = await WebInterfaceBuilder({
                entrypoint:     config.webgui.entrypoint,
                htmlTemplate:   config.webgui.htmlTemplate,
                nodeModulesPath:config.webgui.nodeModules,
                context:        config.webgui.context,
                output,
                url:            "",
                serverAppName:  config.webgui.serverAppName,
                onChangeProgress: (percentage) => {
                    if(!window.isDestroyed() && !window.webContents.isDestroyed())
                        window.webContents.send("build:progress", percentage)
                    const rounded = Math.round(percentage)
                    if(rounded !== lastReportedPct){
                        lastReportedPct = rounded
                        _ReportLaunchProgress("building", rounded)
                    }
                }
            })
            await builder.Run()
            // Grava o fingerprint recém-buildado p/ permitir o reaproveitamento
            // futuro. Calculado ANTES do build (o build só escreve no diretório
            // de saída, que não participa da assinatura), então segue válido.
            if(fingerprint)
                BuildCache.WriteBuildManifest(output, { fingerprint, serverAppName: config.webgui.serverAppName })
            _LoadBundle(output)
        }
    } catch(e) {
        console.error("Falha ao compilar o webgui:", e)
    }
}

app.whenReady().then(() => IS_GUI_HOST ? CreateGuiHostWindow() : CreateWindow())

app.on("window-all-closed", () => app.exit(0))
app.on("before-quit", () => BrowserWindow.getAllWindows().forEach((window) => {
    if(!window.isDestroyed()) window.destroy()
}))
