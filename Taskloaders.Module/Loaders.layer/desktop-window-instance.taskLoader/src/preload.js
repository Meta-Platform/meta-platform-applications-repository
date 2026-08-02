const { contextBridge, ipcRenderer } = require("electron")

// Notificações nativas (já existia): usado pelo ecosystem-control-panel.webgui.
contextBridge.exposeInMainWorld("electronNotifications", {
    show: ({ title, body }) => ipcRenderer.invoke("desktop-notification:show", { title, body })
})

// Placa de vídeo da janela. Só existe no Electron: num navegador comum a
// aplicação não escolhe GPU, e a interface usa a ausência desta ponte para não
// oferecer uma escolha que não teria efeito.
contextBridge.exposeInMainWorld("desktopGpu", {
    getState: () => ipcRenderer.invoke("desktop-gpu:get-state"),
    // Reabre a janela: a escolha da placa é lida na largada do processo.
    setPreference: ({ mode, deviceName }) => ipcRenderer.invoke("desktop-gpu:set-preference", { mode, deviceName })
})

// Progresso do build do webgui (modo GUI-host): o processo principal emite
// "build:progress" com a porcentagem do webpack ProgressPlugin; a tela
// provisória (loading.html) assina para animar a barra determinada.
contextBridge.exposeInMainWorld("buildProgress", {
    onProgress: (callback) => ipcRenderer.on("build:progress", (_event, percentage) => callback(percentage))
})

// Intenção de zoom do teclado (Ctrl+=/+/-/0) e da roda. O processo principal
// intercepta os aceleradores nativos do Chromium ANTES da página (eles nunca
// chegam como keydown) e repassa só a direção: +1 aumenta, -1 diminui, 0
// restaura. Cabe à GUI decidir o que escalar (fonte, layout...). Retorna a
// função de cancelamento da assinatura.
contextBridge.exposeInMainWorld("desktopZoom", {
    onIntent: (callback) => {
        const listener = (_event, direction) => callback(direction)
        ipcRenderer.on("desktop-zoom:intent", listener)
        return () => ipcRenderer.removeListener("desktop-zoom:intent", listener)
    }
})

// Ponte de acesso aos services SEM webservices (modo GUI-host). O renderer
// chama os services hospedados no processo principal do Electron por IPC, no
// lugar de HTTP. window.metaGui só existe nas aplicações Electron GUI-host —
// o webgui usa isso para detectar o transporte (IPC vs axios/HTTP).
//
//  - invoke/getManifest: request/response (equivale a GET/POST/PUT/DELETE).
//  - stream: canal bidirecional (equivale a WebSocket) para logs/console/
//    execução ao vivo. O renderer abre um stream por id; o main roteia os
//    eventos (open/message/close/error) de volta por "metaGui:stream:event".
//    O webgui embrulha isso num objeto compatível com WebSocket (IPCWebSocket).
contextBridge.exposeInMainWorld("metaGui", {
    invoke: (serviceName, method, args) =>
        ipcRenderer.invoke("metaGui:invoke", { serviceName, method, args }),
    getManifest: () => ipcRenderer.invoke("metaGui:manifest"),
    stream: {
        open:  (streamId, serviceName, method, args) =>
            ipcRenderer.send("metaGui:stream:open", { streamId, serviceName, method, args }),
        send:  (streamId, data) => ipcRenderer.send("metaGui:stream:send", { streamId, data }),
        close: (streamId) => ipcRenderer.send("metaGui:stream:close-request", { streamId }),
        onEvent: (callback) => ipcRenderer.on("metaGui:stream:event", (_event, payload) => callback(payload))
    }
})
