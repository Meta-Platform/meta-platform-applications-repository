import GetRequestByServer from "./GetRequestByServer"
import IPCWebSocket       from "./IPCWebSocket"

// Abre o stream de NOTIFICAÇÕES da área de trabalho
// (Notification.StreamNotifications), escolhendo o transporte em runtime —
// mesma mecânica do GetBuildProgressSocket:
//  - Electron GUI-host (window.metaGui) → IPCWebSocket (streaming por IPC).
//  - Navegador/standalone → WebSocket HTTP.
//
// Por aqui chega o que outros apps do ecossistema anunciam pelo POST /notify:
// é como o Meta Project Manager avisa que há entrega esperando revisão sem que
// a pessoa precise estar com ele aberto.
const IsElectronGui = () =>
    typeof window !== "undefined" && Boolean((window as any).metaGui)

const GetNotificationSocket = (serverManagerInformation?: any): any => {
    if(IsElectronGui())
        return new IPCWebSocket("Notification", "StreamNotifications", {})
    try {
        const api = GetRequestByServer(serverManagerInformation)(process.env.SERVER_APP_NAME as string, "Notification")
        return api && api.StreamNotifications ? api.StreamNotifications({}) : null
    } catch(e){
        return null
    }
}

export default GetNotificationSocket
