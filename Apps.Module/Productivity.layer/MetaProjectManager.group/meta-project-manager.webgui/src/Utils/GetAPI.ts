// Do SUBCAMINHO `@i-components/net`, e não do barril: o barril do kit arrasta
// d3/xterm/reactflow, que são ESM e o jest não transforma — importá-lo aqui
// derrubaria test/GetRequestByServer.test.ts. É o mesmo código do kit.
import {
    GetAPI as GetAPIFromKit,
    GetRequestByServer as GetRequestByServerFromKit,
    GetRequestByServerOptions
} from "@i-components/net"

// A camada de transporte (HTTP/WebSocket/IPC) vive no kit — ver @i-components/net.
// O que sobra aqui é a amarração das DUAS opções de que este aplicativo depende,
// num ponto só para que nenhum call site novo as esqueça:
//
//   ipcMode "proxy"  no GUI-host do Electron cada método vira um invoke pelo
//                    nome, sem consultar o manifesto (o MPM não publica um).
//   normalizePath    os controllers do webservice sobem em url:"/", e
//                    servicePath("/") + path("/projects") daria "//projects" —
//                    que o axios lê como protocol-relative e descarta o host.
//                    Travado por test/GetRequestByServer.test.ts.
const TRANSPORT: GetRequestByServerOptions = { ipcMode: "proxy", normalizePath: true }

export const GetRequestByServer = (serverManagerInformation: any) =>
    GetRequestByServerFromKit(serverManagerInformation, TRANSPORT)

export const GetAPI = (
    { apiName, serverManagerInformation }: { apiName: string, serverManagerInformation: any }
) => GetAPIFromKit({ apiName, serverManagerInformation }, TRANSPORT)

export default GetAPI
