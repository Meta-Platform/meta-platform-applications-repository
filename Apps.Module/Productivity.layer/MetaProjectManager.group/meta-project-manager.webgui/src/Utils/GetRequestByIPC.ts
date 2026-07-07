// Transporte IPC (aplicações Electron GUI-host): no lugar de HTTP/webservices,
// o renderer chama os services hospedados no processo principal do Electron por
// window.metaGui.invoke(serviceName, method, args). Espelha a superfície do
// GetRequestByServer (HTTP): retorna um objeto cujos métodos, ao serem
// chamados, disparam o invoke e embrulham o retorno em { data } — compatível
// com o shape de resposta do axios que os containers já leem.
//
// Usa Proxy para não precisar enumerar métodos: qualquer acesso a
// api.NomeDoMetodo(args) vira invoke(apiName, "NomeDoMetodo", args).

const GetRequestByIPC = (apiName: string) =>
    new Proxy({} as any, {
        get: (_target, method: string) =>
            (data?: object) =>
                (window as any).metaGui
                    .invoke(apiName, method, data)
                    .then((result: any) => ({ data: result }))
    })

export default GetRequestByIPC
