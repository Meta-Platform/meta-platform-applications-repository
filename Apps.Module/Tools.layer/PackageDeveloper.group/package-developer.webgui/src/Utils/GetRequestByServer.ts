// Do SUBCAMINHO `@i-components/net`, e não do barril: o barril arrasta d3/xterm
// (ESM) para dentro do jest, que não os transforma.
import { GetRequestByServer as GetRequestByServerFromKit } from "@i-components/net"

// A camada de transporte (HTTP/WebSocket/IPC) vive no kit — ver @i-components/net.
// O que sobra aqui é UMA amarração: este aplicativo precisa de `wsQueryParams`.
//
// Sem essa opção o WebSocket nasce sem argumentos, e o GitStatusStream abre
// `/git/status` no lugar de `/git/status?repositories=…` — a árvore para de
// receber estado do git e NADA nisso aparece no build. Amarrar a opção num
// ponto só é o que impede um call site novo de esquecê-la.
export const GetRequestByServer = (serverManagerInformation:any) =>
    GetRequestByServerFromKit(serverManagerInformation, { wsQueryParams: true })

export default GetRequestByServer
