import { GetRequestByServer, ServerAppName } from "@i-components/net"

// Helper único de acesso aos controllers (dual-transport: IPC no Electron
// GUI-host, HTTP fora dele). Uso: Api(HTTPServerManager)("RelacionalDatabaseHandler").SelectRows({...})
//
// `wsQueryParams` é obrigatório aqui: os streams deste aplicativo (log ao vivo,
// terminal, métricas) levam argumentos em `in:"query"`, e sem a opção o
// WebSocket nasceria sem eles.
const Api = (HTTPServerManager:any) => (apiName:string) =>
    GetRequestByServer(HTTPServerManager, { wsQueryParams: true })(ServerAppName(), apiName)

export default Api
