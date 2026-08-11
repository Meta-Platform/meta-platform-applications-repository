import { GetRequestByServer, IPCWebSocket, IsElectronGui, ServerAppName } from "@i-components/net"

// Abre o stream de progresso de LANÇAMENTO de aplicações
// (Execution.BuildProgressStream), escolhendo o transporte em runtime:
//  - Electron GUI-host (window.metaGui) → IPCWebSocket (streaming por IPC).
//  - Navegador/standalone → WebSocket HTTP, reusando o GetRequestByServer.
// Ambos expõem a mesma superfície (onopen/onmessage/onclose/onerror/close).

const GetBuildProgressSocket = (serverManagerInformation?: any): any => {
    if(IsElectronGui())
        return new IPCWebSocket("Execution", "BuildProgressStream", {})
    try {
        const api = GetRequestByServer(serverManagerInformation)(ServerAppName(), "Execution")
        return api && api.BuildProgressStream ? api.BuildProgressStream({}) : null
    } catch(e){
        return null
    }
}

export default GetBuildProgressSocket
