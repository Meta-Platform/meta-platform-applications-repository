import GetRequestByServer  from "./GetRequestByServer"
import GetRequestByIPC     from "./GetRequestByIPC"

// Detecta o transporte em runtime (dual-transport):
//  - Electron GUI-host (window.metaGui existe) → IPC, sem webservices HTTP.
//  - Navegador/standalone → HTTP via serverManagerInformation (comportamento
//    original inalterado).
const IsElectronGui = () =>
	typeof window !== "undefined" && Boolean((window as any).metaGui)

const GetAPI = ({ apiName, serverManagerInformation }: { apiName:string, serverManagerInformation: any}) =>
	IsElectronGui()
		? GetRequestByIPC(apiName)
		: GetRequestByServer(serverManagerInformation)(process.env.SERVER_APP_NAME, apiName)


export default GetAPI
