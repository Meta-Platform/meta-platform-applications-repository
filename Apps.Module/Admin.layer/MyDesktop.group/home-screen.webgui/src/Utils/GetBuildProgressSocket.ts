import GetRequestByServer from "./GetRequestByServer"
import IPCWebSocket       from "./IPCWebSocket"

// Abre o stream de progresso de LANÇAMENTO de aplicações
// (Execution.BuildProgressStream), escolhendo o transporte em runtime:
//  - Electron GUI-host (window.metaGui) → IPCWebSocket (streaming por IPC).
//  - Navegador/standalone → WebSocket HTTP, reusando o GetRequestByServer.
// Ambos expõem a mesma superfície (onopen/onmessage/onclose/onerror/close).
const IsElectronGui = () =>
    typeof window !== "undefined" && Boolean((window as any).metaGui)

const GetBuildProgressSocket = (serverManagerInformation?: any): any => {
    if(IsElectronGui())
        return new IPCWebSocket("Execution", "BuildProgressStream", {})
    try {
        const api = GetRequestByServer(serverManagerInformation)(process.env.SERVER_APP_NAME as string, "Execution")
        return api && api.BuildProgressStream ? api.BuildProgressStream({}) : null
    } catch(e){
        return null
    }
}

export default GetBuildProgressSocket
