/* Deliberadamente JavaScript: este arquivo é o ponto de entrada que o binário do
 * Electron recebe como um CAMINHO, e não como um specifier de módulo — quem o
 * carrega não passa pela resolução instalada abaixo. Pelo mesmo motivo continuam
 * em JavaScript o `preload.js` (carregado pelo renderer) e o `GpuPreference.js`
 * (requerido daqui). O resto do que este processo carrega PODE ser `.ts`: o
 * Electron 43 embute o Node 24.18, que apaga tipos e tem `module.registerHooks`.
 * Ver source-language-standard.md. */

const { app, BrowserWindow, Menu, dialog, ipcMain, Notification, nativeImage, protocol, net } = require("electron")
const http  = require("http")
const https = require("https")
const crypto = require("crypto")
const fs = require("fs")
const { join, dirname } = require("path")
const { pathToFileURL } = require("url")
const { ResolveGpuLaunch, ListVulkanDevices, WritePreference } = require("./GpuPreference")

// Resolução de `.ts` deste processo, pelo mesmo motivo do logger abaixo: o
// Electron é processo SEPARADO e nada do que o executor instalou vale aqui. Vem
// primeiro porque a própria logger.lib pode ser TypeScript.
// Ver: meta-platform-open-standard/specifications/source-language-standard.md
/* Verdadeiro só quando o `.ts` de fato carrega aqui dentro. É lido mais abaixo,
 * na montagem dos services do gui-host, para que a falha tenha nome. */
let resolveTypeScriptDisponivel = false

const InstallElectronTypeScriptResolution = () => {
    try {
        const installTypeScriptResolutionPath = process.env.META_INSTALL_TYPESCRIPT_RESOLUTION_PATH
        if(!installTypeScriptResolutionPath) return
        require(installTypeScriptResolutionPath)()
        resolveTypeScriptDisponivel = true
    } catch (error) {
        /* Duas causas possíveis, e elas pedem respostas opostas:
         *
         *   - repositório anterior à module-resolution.lib → não há `.ts` para
         *     resolver, e seguir é o correto;
         *   - o Node deste Electron é antigo demais (anterior ao 22.18, sem
         *     apagamento de tipos e sem `registerHooks`) → há `.ts` para
         *     resolver e ele NÃO vai carregar. Foi o que aconteceu enquanto o
         *     taskLoader esteve no Electron 31 (Node 20.18).
         *
         * O segundo caso é o que importa hoje, e engoli-lo em silêncio foi o
         * que fez esta falha passar despercebida: cada service do gui-host
         * morria depois, um a um, com MODULE_NOT_FOUND — longe da causa.
         * Registrar aqui não conserta nada, mas dá nome ao que aconteceu. */
        console.error(
            "[electron-main] a resolução de TypeScript NÃO foi instalada neste processo"
            + ` (Node ${process.versions.node}, electron ${process.versions.electron}).`
            + " Pacotes .ts não carregam aqui dentro."
            + ` Motivo: ${(error && error.message) || error}`)
    }
}
InstallElectronTypeScriptResolution()

// `globalThis.Log` deste processo. O Electron é um processo SEPARADO: sem esta
// instalação, todo log de app desktop existiria apenas como texto no stdout que
// o daemon captura — fora do padrão e sem estrutura. O caminho da lib e o
// destino do log chegam por env, porque o subprocesso não recebe módulos.
// Ver: meta-platform-open-standard/specifications/logging-standard.md
const InstallElectronLogger = () => {
    try {
        const installGlobalLoggerPath = process.env.META_INSTALL_GLOBAL_LOGGER_PATH
        if(!installGlobalLoggerPath) return
        require(installGlobalLoggerPath)({
            origin      : "electron",
            package     : process.env.DESKTOP_WINDOW_WM_CLASS || null,
            instanceId  : process.env.META_LAUNCH_ID || null,
            logsDirPath : process.env.META_LOGS_DIR || null
        })
    } catch (error) {
        /* Log é observabilidade, não caminho crítico: a janela abre mesmo assim. */
    }
}
InstallElectronLogger()

/*
    REDE DE SEGURANÇA DO `Log`.

    Este arquivo chama `Log.error(...)` em cinco caminhos de ERRO. Se a
    instalação acima não acontecer — e ela não acontece quando a logger.lib está
    em TypeScript, porque o Node do Electron não carrega `.ts` —, cada uma
    dessas chamadas vira um ReferenceError: o diagnóstico do problema some e é
    substituído por uma quebra, justamente onde algo já tinha dado errado.

    Não é uma cópia do logger: é o mínimo para que registrar um erro nunca seja
    o que derruba o processo. Some assim que o canônico conseguir subir aqui.
*/
if(!globalThis.Log){
    const escrever = (nivel) => (origem, ...resto) =>
        console[nivel === "error" ? "error" : "log"](`[${nivel}] [${origem}]`, ...resto)

    globalThis.Log = {
        trace: escrever("trace"), debug: escrever("debug"), info: escrever("info"),
        message: escrever("message"), warn: escrever("warn"), error: escrever("error"),
        fatal: escrever("fatal"),
        child: () => globalThis.Log, source: () => globalThis.Log,
        minimal: true
    }
}

const DEFAULT_WIDTH  = 1024
const DEFAULT_HEIGHT = 768
const POLL_INTERVAL_MS   = 800
const REQUEST_TIMEOUT_MS = 2000
const ASSET_POLL_INTERVAL_MS = 1200

// Durante um rebuild, o servidor continua entregando o bundle do build ANTERIOR
// (200 com conteúdo obsoleto — não 404), então a janela carrega a versão velha
// logo no start. Nessa fase inicial não há estado de tela a preservar: a troca
// pelo bundle recém-compilado é feita direto, sem o diálogo de confirmação.
// Folga generosa sobre o build mais pesado observado (~40s no 3d-viewer).
const INITIAL_REBUILD_WINDOW_MS = 120000

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

// Placa de vídeo da janela: a preferência é por app (a classe X11 identifica
// qual). Aqui aplicamos só o SWITCH — a variável ANGLE_PREFERRED_DEVICE tem de
// vir de quem abriu este processo, e o task loader já a injetou no env. O porquê
// dessa divisão está em GpuPreference.js.
const GPU_STATE = ResolveGpuLaunch(WM_CLASS)
if(GPU_STATE.useVulkan) app.commandLine.appendSwitch("use-angle", "vulkan")

// Código de saída reservado: "não fui fechado, quero reabrir". Trocar de placa
// exige um processo novo (a escolha é flag de linha de comando), e `relaunch()`
// deixaria o app fora do monitor de instâncias — o processo que nos abriu morre
// junto. Então saímos com este código e quem nos abriu (o task loader) reabre a
// janela, mantendo a MESMA instância.
const RESTART_EXIT_CODE = 87

// Sair pedindo reabertura destrói a janela, e a destruição dispara os mesmos
// caminhos de "o usuário fechou" — que encerravam com 0 por cima do nosso
// código, transformando o pedido de reabertura em fim de execução. A intenção
// fica registrada aqui e TODA saída passa por ela.
let restartRequested = false
const ExitApp = () => app.exit(restartRequested ? RESTART_EXIT_CODE : 0)

// Rota inicial da aplicação: quando quem manda abrir sabe ONDE quer chegar (o
// Package Developer abrindo o Instance Executor já na instância que acabou de
// lançar, para debugar), o daemon injeta META_INITIAL_ROUTE no env e ela é
// aplicada como HASH da página carregada.
//
// Hash, e não caminho, porque os webguis da plataforma roteiam com HashRouter:
// o arquivo carregado é sempre o mesmo index.html, e o que muda é o que vem
// depois do "#".
const INITIAL_ROUTE = process.env.META_INITIAL_ROUTE

// O Electron espera o hash SEM o "#"; a rota pode chegar com ou sem ele.
const _InitialHash = () =>
    INITIAL_ROUTE ? String(INITIAL_ROUTE).replace(/^#/, "") : undefined

const _LoadFileWithRoute = (window, filePath) => {
    const hash = _InitialHash()
    return hash ? window.loadFile(filePath, { hash }) : window.loadFile(filePath)
}

const _LoadURLWithRoute = (window, url) => {
    const hash = _InitialHash()
    // Uma url que já traga hash manda: ela é mais específica que o pedido geral.
    return window.loadURL(hash && !url.includes("#") ? `${url}#${hash}` : url)
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

// Canal de CONTROLE DE JANELA desta instância. O daemon (executor-manager)
// precisa poder trazer esta janela para frente quando o usuário clica no ícone
// de um aplicativo que já está aberto — em vez de abrir outra instância. Para
// isso publicamos um Unix socket por instância (caminho injetado pelo daemon em
// META_WINDOW_CONTROL_SOCKET, derivado do instanceId), no mesmo espírito do
// socket de tarefas que o processo `run` já publica.
//
// Superfície mínima: POST /focus → { focused }.
// Best-effort: qualquer falha aqui é ignorada — o canal é conveniência, não
// pode impedir a janela de abrir nem derrubar o app.
const StartWindowControlServer = (window) => {
    const socketPath = process.env.META_WINDOW_CONTROL_SOCKET
    if(!socketPath) return

    const _FocusWindow = () => {
        if(window.isDestroyed()) return false
        if(window.isMinimized()) window.restore()
        window.show()
        window.focus()
        // No X11 o gerenciador de janelas costuma apenas piscar a entrada da
        // barra de tarefas quando o foco é pedido por outro processo. O pulo
        // por "sempre no topo" (imediatamente revertido) força a elevação sem
        // deixar a janela presa acima das demais.
        try {
            window.setAlwaysOnTop(true)
            window.setAlwaysOnTop(false)
        } catch(e) {}
        return true
    }

    try {
        fs.mkdirSync(dirname(socketPath), { recursive: true })
        // Sobra de um processo que morreu sem limpar: o bind falharia com EADDRINUSE.
        try { fs.unlinkSync(socketPath) } catch(e) {}

        const server = http.createServer((request, response) => {
            if(request.method === "POST" && request.url === "/focus"){
                const focused = _FocusWindow()
                response.writeHead(200, { "Content-Type": "application/json" })
                response.end(JSON.stringify({ focused }))
                return
            }
            response.writeHead(404)
            response.end()
        })
        server.on("error", () => {})
        server.listen(socketPath)

        const _CleanUp = () => {
            try { server.close() } catch(e) {}
            try { fs.unlinkSync(socketPath) } catch(e) {}
        }
        // O fechamento da janela chama app.exit(0) direto (outro listener), que
        // pode não dar tempo aos listeners seguintes: por isso limpamos também
        // no "exit" do processo.
        window.on("closed", _CleanUp)
        app.on("before-quit", _CleanUp)
        process.on("exit", _CleanUp)
    } catch(e) {}
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

// Zoom da interface (Ctrl+= / + / - / 0 e Ctrl+roda) gerido AQUI, com o zoom
// REAL do Chromium (setZoomFactor). Com ele os media queries enxergam um
// viewport menor e o layout SE ADAPTA, como numa janela estreita — diferente
// de `zoom` CSS na raiz da página, que desloca a pintura e quebra o shell
// (bug E3DV-233). O Chromium persiste o fator por origem sozinho, então a
// preferência sobrevive ao reabrir. Os atalhos são interceptados no processo
// principal (before-input-event) para valerem em TODO desktopapp,
// independente de layout de teclado e sem depender de código da GUI.
const ZOOM_LEVELS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2]
const InstallManagedZoom = (window) => {
    const contents = window.webContents
    const Aplicar = (fator) => { try { contents.setZoomFactor(fator) } catch(e) { /* janela fechando */ } }
    const Passo = (direcao) => {
        let atual = 1
        try { atual = contents.getZoomFactor() } catch(e) {}
        const indice = ZOOM_LEVELS.findIndex(nivel => Math.abs(nivel - atual) < 0.051)
        Aplicar(indice === -1 ? 1 : ZOOM_LEVELS[Math.min(Math.max(indice + direcao, 0), ZOOM_LEVELS.length - 1)])
    }
    // Pinch fica travado: zoom só por atalho/roda, sempre em degraus conhecidos.
    try { contents.setVisualZoomLevelLimits(1, 1) } catch(e) {}
    contents.on("before-input-event", (event, input) => {
        if(input.type !== "keyDown" || !input.control || input.alt || input.meta) return
        const mais  = input.key === "+" || input.key === "="
        const menos = input.key === "-" || input.key === "_"
        // Numpad0 fica de fora: é atalho de vista da cena nos apps 3D.
        const zero  = input.key === "0" && input.code !== "Numpad0"
        if(!mais && !menos && !zero) return
        event.preventDefault()
        if(zero) Aplicar(1)
        else Passo(mais ? 1 : -1)
    })
    // Ctrl+roda pede zoom ao browser; entra nos mesmos degraus do teclado.
    contents.on("zoom-changed", (event, direction) => {
        event.preventDefault()
        Passo(direction === "in" ? 1 : -1)
    })
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
    window.on("closed", () => ExitApp())

    InstallManagedZoom(window)

    // Canal de foco: permite ao daemon trazer esta janela para frente.
    StartWindowControlServer(window)

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
        _LoadFileWithRoute(window, file)
        return
    }

    // Modo loadURL: mostra a página provisória e faz polling até o front-end
    // buildado responder; então troca para ele.
    let loaded = false
    let readyReported = false
    let currentBundleSignature
    let ignoredBundleSignature
    let promptOpen = false
    let loadedAt = 0

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
            loadedAt = Date.now()
            currentBundleSignature = await GetBundleSignature(url)
            // "ready" NÃO é reportado aqui: servidor respondendo 200 não é o
            // mesmo que a UI renderizada. Quem reporta é o did-finish-load do
            // front-end real (handler abaixo).
            if(!window.isDestroyed()) _LoadURLWithRoute(window, url)
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
            _LoadURLWithRoute(window, url)
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
            // Logo após o start, o que está na tela veio do build ANTERIOR (o
            // servidor entrega o bundle velho enquanto recompila) e pode nem ter
            // renderizado — era o caso da janela em branco. Não há estado a
            // preservar nem o que perguntar: troca direto pelo bundle novo.
            // Passada essa fase, a tela é de uso real e a confirmação volta a
            // valer (evita interromper o trabalho no watch mode).
            if(Date.now() - loadedAt < INITIAL_REBUILD_WINDOW_MS) {
                currentBundleSignature = newBundleSignature
                if(!window.isDestroyed()) _LoadURLWithRoute(window, url)
            } else {
                await ConfirmReload(newBundleSignature)
            }
        }

        if(!window.isDestroyed())
            setTimeout(PollForUpdatedBundle, ASSET_POLL_INTERVAL_MS)
    }

    /* A tela em branco que não se resolve sozinha.

       O servidor responde 200 ao HTML mesmo quando o bundle ainda não existe
       (rebuild em curso, provisionamento por cima do app aberto): a página
       carrega, `did-fail-load` NÃO dispara — não houve falha de rede — e a
       janela fica vazia para sempre, sem nada na tela que explique o quê.

       Depois de carregar o front-end real, conferimos se ele de fato pintou
       alguma coisa. Se não pintou, tratamos como não-carregado: volta para a
       tela de carregamento e o polling recomeça, pegando o bundle assim que
       ele ficar pronto. */
    const EMPTY_PAGE_CHECK_MS = 6000
    const EMPTY_PAGE_MIN_HTML = 200
    // Teto de tentativas: se uma aplicação legitimamente pinta quase nada, ela
    // não pode ficar recarregando para sempre. Passado o teto, a tela é dela.
    const EMPTY_PAGE_MAX_RECOVERIES = 10
    let emptyPageRecoveries = 0

    const RecoverIfBlank = async () => {
        if(!loaded || window.isDestroyed() || promptOpen) return
        if(emptyPageRecoveries >= EMPTY_PAGE_MAX_RECOVERIES) return
        let renderedLength = EMPTY_PAGE_MIN_HTML
        try {
            renderedLength = await window.webContents.executeJavaScript(
                "document.body ? document.body.innerHTML.trim().length : 0"
            )
        } catch (error) {
            // Não conseguir perguntar não é motivo para descartar a tela.
            return
        }
        if(renderedLength >= EMPTY_PAGE_MIN_HTML || window.isDestroyed()) return

        emptyPageRecoveries += 1
        if(globalThis.Log) Log.warn("electron-main", `a interface carregou vazia — voltando a esperar o build (tentativa ${emptyPageRecoveries})`)
        loaded = false
        currentBundleSignature = undefined
        ignoredBundleSignature = undefined
        window.loadFile(LOADING_PAGE)
        if(title) window.setTitle(title)
        setTimeout(PollUntilReady, POLL_INTERVAL_MS)
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
        // Carregou "com sucesso" não quer dizer que apareceu algo: ver RecoverIfBlank.
        if(loaded) setTimeout(RecoverIfBlank, EMPTY_PAGE_CHECK_MS)
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

// ======================================================================
// Placa de vídeo: o que está ativo, o que existe e como trocar.
// ======================================================================

// O que a interface precisa para montar a escolha: as placas da máquina, a
// preferência gravada e o que o Chromium REALMENTE ativou (que pode divergir da
// preferência — driver ausente, placa desligada). Sem esse último dado o menu
// diria "NVIDIA" enquanto a cena roda na integrada.
ipcMain.handle("desktop-gpu:get-state", async () => {
    let activeRenderer = null
    try {
        const info = await app.getGPUInfo("complete")
        activeRenderer = (info.auxAttributes || {}).glRenderer || null
    } catch (error) {
        /* Diagnóstico é opcional: sem ele o menu ainda funciona. */
    }
    return {
        mode      : GPU_STATE.mode,
        deviceName: GPU_STATE.deviceName || null,
        applied   : GPU_STATE.useVulkan,
        reason    : GPU_STATE.reason,
        devices   : ListVulkanDevices(),
        activeRenderer
    }
})

// Grava a escolha e reabre a janela para ela valer. A troca sem reabrir não
// existe: as flags de GPU são lidas uma única vez, na largada do processo.
ipcMain.handle("desktop-gpu:set-preference", async (_event, { mode, deviceName } = {}) => {
    const preference = WritePreference(WM_CLASS, { mode, deviceName })
    restartRequested = true
    setTimeout(ExitApp, 120)
    return { ...preference, restarting: true }
})

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
        Log.error("electron-main", "Falha ao ler DESKTOP_GUI_CONFIG_PATH:", e)
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
    window.on("closed", () => ExitApp())
    InstallManagedZoom(window)
    StartWindowControlServer(window)
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
        /* Um MODULE_NOT_FOUND aqui aponta para o arquivo errado quando a
         * resolução de `.ts` não subiu: o módulo existe, com outra extensão. */
        Log.error("electron-main", "Falha ao inicializar os services de GUI:", e)
        if(!resolveTypeScriptDisponivel)
            Log.error("electron-main",
                "a resolução de TypeScript não está instalada neste processo"
                + ` (Node ${process.versions.node}): um service em \`.ts\` aparece aqui como módulo inexistente.`)
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
            Log.error("ElectronMain", "falha ao abrir stream", { serviceName, method, error: e })
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
        _LoadFileWithRoute(window, join(output, "index.html"))
    }

    try {
        // Subprocesso Electron: resolve o WebInterfaceBuilder (ecosystem-core) e o
        // SmartRequire (essential) pelos PATHS injetados no env pelo OpenElectronWindow.
        // A lib é uma fábrica que recebe o SmartRequire.
        const WebInterfaceBuilder = require(process.env.META_WEB_INTERFACE_BUILDER_PATH)(require(process.env.META_SMART_REQUIRE_PATH))
        const output = MountGuiOutputDir(config.webgui)

        {
            // O cache de build agora é do próprio builder: ele assina as
            // entradas, decide se há o que compilar e grava o manifesto. Este
            // arquivo mantinha uma cópia dessa lógica, que precisava andar em
            // sincronia com a do outro caminho — e não andava.
            //
            // Reporta o progresso ao daemon apenas quando o inteiro muda, para
            // não inundar o socket com frações intermediárias.
            let lastReportedPct = -1
            const builder = await WebInterfaceBuilder({
                entrypoint:     config.webgui.entrypoint,
                htmlTemplate:   config.webgui.htmlTemplate,
                nodeModulesPath:config.webgui.nodeModules,
                context:        config.webgui.context,
                output,
                url:            "",
                serverAppName:  config.webgui.serverAppName,
                componentLibraries: config.webgui.componentLibraries,
                // Uma janela desktop nunca observa alterações: ela compila uma
                // vez ao abrir. O perfil define o CUSTO desse build (minificado
                // e sem mapa de código, ou rápido e depurável).
                buildProfile:    config.webgui.buildProfile,
                environmentPath: config.webgui.environmentPath,
                generatedDirName:config.webgui.RT_ENV_GENERATED_DIR_NAME,
                // O build sai deste processo. Uma janela desktop fica aberta por
                // horas, e soltar as referências do build não devolve memória ao
                // sistema: o V8 mantém o heap que reservou. Quem devolve página
                // ao SO é o processo ao morrer — então o build acontece num
                // filho efêmero, e este processo nunca chega a alocá-lo.
                isolateBuild:    true,
                buildIsolated:   config.params && config.params.RT_WEBGUI_BUILD_ISOLATED,
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

            const { fromCache } = await builder.Run()

            Log.info("electron-main", fromCache
                ? `[webgui] bundle atualizado — reaproveitando (sem build): ${output}`
                : `[webgui] front-end montado: ${config.webgui.serverAppName}`)

            _LoadBundle(output)
        }
    } catch(e) {
        Log.error("electron-main", "Falha ao compilar o webgui:", e)
    }
}

app.whenReady().then(() => IS_GUI_HOST ? CreateGuiHostWindow() : CreateWindow())

app.on("window-all-closed", () => ExitApp())
app.on("before-quit", () => BrowserWindow.getAllWindows().forEach((window) => {
    if(!window.isDestroyed()) window.destroy()
}))
