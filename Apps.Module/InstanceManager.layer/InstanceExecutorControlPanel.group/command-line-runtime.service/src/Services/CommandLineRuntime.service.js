// Serviço-proxy do painel para a execução de pacotes CLI.
//
// O InstanceExecutorControlPanel não executa nada por si — delega ao daemon
// `executor-manager` através de `@/instance-manager-client.lib`. Este serviço
// cria o cliente do daemon uma vez e expõe os métodos de terminal/CLI para o
// controller (que faz a ponte com o navegador via HTTP/WS ou IPC).
const CommandLineRuntimeService = (params) => {

    const {
        instanceManagerClientLib,
        platformApplicationSocketPath,
        httpServerManagerEndpoint,
        onReady
    } = params

    const CreateInstanceManagerClient = instanceManagerClientLib.require("CreateInstanceManagerClient")

    const client = CreateInstanceManagerClient({
        platformApplicationSocketPath,
        ...httpServerManagerEndpoint ? { httpServerManagerEndpoint } : {}
    })

    if(onReady)
        onReady()

    return {
        IsAvailable           : client.IsAvailable,
        RunCommandLinePackage : client.RunCommandLinePackage,
        ListTerminals         : client.ListTerminals,
        KillTerminal          : client.KillTerminal,
        OpenTerminalStream    : client.OpenTerminalStream
    }
}

module.exports = CommandLineRuntimeService
