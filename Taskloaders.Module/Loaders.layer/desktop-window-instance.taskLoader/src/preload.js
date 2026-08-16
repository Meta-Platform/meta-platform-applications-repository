/* Deliberadamente JavaScript: este arquivo é carregado pelo Chromium como
 * `webPreferences.preload` — um CAMINHO entregue ao processo do renderer, que
 * não herda hook de resolução nenhum e roda no Node embutido do Electron
 * (anterior ao 22.18, que é quando o Node passou a apagar tipos sozinho).
 * Ver o cabeçalho do electron-main.js. */

const { contextBridge, ipcRenderer, webUtils } = require("electron")

// Notificações nativas (já existia): usado pelo ecosystem-control-panel.webgui.
contextBridge.exposeInMainWorld("electronNotifications", {
    show: ({ title, body }) => ipcRenderer.invoke("desktop-notification:show", { title, body })
})

/* Caminho real de um arquivo escolhido pelo usuário.
 *
 * O objeto `File` do navegador NÃO tem caminho — o Chromium expunha um
 * `file.path` fora do padrão, e o Electron 32 o removeu. Quem precisa do
 * caminho (para abrir um banco SQLite, por exemplo) tem de perguntar ao
 * `webUtils`, que só existe deste lado da ponte.
 *
 * Escrito antes de a subida do Electron acontecer, e funcionando desde o 29:
 * é o que permite que a interface pare de depender do `file.path` hoje, em vez
 * de descobrir a ausência dele no dia da subida — quando a falha seria muda (o
 * diálogo fecha e nada acontece). */
contextBridge.exposeInMainWorld("desktopFiles", {
    getPathForFile: (file) => webUtils.getPathForFile(file)
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
