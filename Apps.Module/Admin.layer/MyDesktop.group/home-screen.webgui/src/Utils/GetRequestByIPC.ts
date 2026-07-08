// Transporte IPC (aplicações Electron GUI-host): no lugar de HTTP/webservices,
// o renderer chama os services hospedados no processo principal do Electron por
// window.metaGui.invoke(serviceName, method, args). Espelha a superfície do
// GetRequestByServer (HTTP): retorna um objeto cujos métodos, ao serem
// chamados, disparam o invoke e embrulham o retorno em { data } — compatível
// com o shape de resposta do axios que os containers já leem.
//
// Usa Proxy para não precisar enumerar métodos: qualquer acesso a
// api.NomeDoMetodo(args) vira invoke(apiName, "NomeDoMetodo", args).

// O Electron embrulha qualquer erro lançado em ipcMain.handle com o prefixo
// técnico "Error invoking remote method '<canal>': ". Removemos esse ruído para
// que o usuário veja apenas a mensagem de negócio lançada pelo controller.
const _CleanIpcError = (error: any) => {
    const raw = typeof error === "string" ? error : (error?.message || "")
    const message = raw.replace(/^Error invoking remote method '[^']*':\s*/, "")
    return new Error(message || "Falha na comunicação com o processo principal.")
}

const GetRequestByIPC = (apiName: string) =>
    new Proxy({} as any, {
        get: (_target, method: string) =>
            (data?: object) =>
                (window as any).metaGui
                    .invoke(apiName, method, data)
                    .then((result: any) => ({ data: result }))
                    .catch((error: any) => { throw _CleanIpcError(error) })
    })

export default GetRequestByIPC
