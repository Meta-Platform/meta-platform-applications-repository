import GetRequestByServer from "./GetRequestByServer"

// Helper único de acesso aos controllers (dual-transport: IPC no Electron
// GUI-host, HTTP fora dele). Uso: Api(HTTPServerManager)("RelacionalDatabaseHandler").SelectRows({...})
const Api = (HTTPServerManager:any) => (apiName:string) =>
    GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME as string, apiName)

export default Api
