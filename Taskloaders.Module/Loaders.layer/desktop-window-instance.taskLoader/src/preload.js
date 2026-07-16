const { contextBridge, ipcRenderer } = require("electron")

// Notificações nativas (já existia): usado pelo ecosystem-control-panel.webgui.
contextBridge.exposeInMainWorld("electronNotifications", {
    show: ({ title, body }) => ipcRenderer.invoke("desktop-notification:show", { title, body })
})

// Progresso do build do webgui (modo GUI-host): o processo principal emite
// "build:progress" com a porcentagem do webpack ProgressPlugin; a tela
// provisória (loading.html) assina para animar a barra determinada.
contextBridge.exposeInMainWorld("buildProgress", {
    onProgress: (callback) => ipcRenderer.on("build:progress", (_event, percentage) => callback(percentage))
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
