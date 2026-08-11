import { GetRequestByServer, ServerAppName } from "@i-components/net"

// Helper único de acesso aos controllers (dual-transport: IPC no Electron
// GUI-host, HTTP fora dele). Uso: Api(HTTPServerManager)("RelacionalDatabaseHandler").SelectRows({...})
//
// `ipcMode: "proxy"` é obrigatório aqui: no modo janela este aplicativo não
// consulta o manifesto — todo método vira um `metaGui.invoke` pelo nome.
const Api = (HTTPServerManager:any) => (apiName:string) =>
    GetRequestByServer(HTTPServerManager, { ipcMode: "proxy" })(ServerAppName(), apiName)

export default Api
