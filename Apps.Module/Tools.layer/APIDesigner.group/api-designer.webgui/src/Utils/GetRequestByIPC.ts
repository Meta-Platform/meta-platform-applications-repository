// Transporte IPC (aplicações Electron GUI-host): no lugar de HTTP/webservices,
// o renderer chama os services hospedados no processo principal do Electron via
// window.metaGui.invoke(serviceName, method, data). Espelha a superfície do
// GetRequestByServer (HTTP) e embrulha o retorno em { data } — compatível com o
// shape de resposta que os containers já leem. Usa Proxy para não enumerar
// métodos: api.NomeDoMetodo(data) → invoke(apiName, "NomeDoMetodo", data).
const GetRequestByIPC = (apiName: string) =>
    new Proxy({} as any, {
        get: (_target, method: string) =>
            (data?: object) =>
                (window as any).metaGui
                    .invoke(apiName, method, data)
                    .then((result: any) => ({ data: result }))
    })

export default GetRequestByIPC
