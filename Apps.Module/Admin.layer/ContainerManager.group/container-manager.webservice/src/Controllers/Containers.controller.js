/*
    Controller de CONTAINERS, sempre no contexto de uma conexão.

    Cada operação recebe `connectionId` e é executada no adaptador daquela
    conexão — é assim que Docker e Podman convivem sem o aplicativo ter dois
    caminhos de código.
*/

const CreateRuntimeAccess = require("../Helpers/CreateRuntimeAccess")

const ContainersController = (params) => {

    const { containerRuntimeConnectionService } = params
    const { WithAdapter } = CreateRuntimeAccess({ containerRuntimeConnectionService })

    const _ListContainers = (connectionId) =>
        WithAdapter(connectionId, (adaptador) => adaptador.ListAllContainers())

    const _InspectContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.InspectContainer(containerIdOrName))

    const _GetContainerLogHistory = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.GetContainerLogHistory(containerIdOrName))

    const _StartContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.StartContainer(containerIdOrName))

    const _StopContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.StopContainer(containerIdOrName))

    const _RestartContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RestartContainer(containerIdOrName))

    const _KillContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.KillContainer(containerIdOrName))

    const _RemoveContainer = ({ connectionId, containerIdOrName }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.RemoveContainer(containerIdOrName))

    const _CreateContainer = ({ connectionId, options }) =>
        WithAdapter(connectionId, (adaptador) => adaptador.CreateNewContainer(options))

    /*
        ---- streams (CTMG-21, 22, 23) ----

        Os três seguem o mesmo desenho, e a razão dele é uma só: um stream do
        runtime é um recurso VIVO no outro lado. Se o operador fecha a aba e
        ninguém avisa o runtime, fica uma conexão pendurada por container
        aberto — em uma tela de monitoração, isso se acumula rápido.

        Por isso todo stream aqui:
        1. avisa o cliente e fecha quando o runtime falha ou termina;
        2. desliga a fonte quando o CLIENTE fecha (`ws.on("close")`);
        3. envia sempre JSON — a mesma superfície no WebSocket do navegador e
           no canal IPC do modo janela, que é o que faz a webgui ter um código
           só para os dois.
    */
    const _EnviarNoSocket = (ws, payload) => {
        try {
            if (ws.readyState === undefined || ws.readyState === 1) ws.send(JSON.stringify(payload))
        } catch (error) {
            // Socket já fechado do outro lado: nada a fazer, e nada a registrar.
        }
    }

    const _FecharSocket = (ws) => {
        try { ws.close() } catch (error) { /* já fechado */ }
    }

    /*
        Abre a fonte no runtime e amarra os dois lados. `AbrirFonte` recebe os
        callbacks e devolve o handle com `Close` — o contrato do adaptador.
    */
    const _MontarStream = async (ws, connectionId, AbrirFonte) => {
        let fonte = null
        let fechado = false

        const Encerrar = () => {
            if (fechado) return
            fechado = true
            if (fonte && typeof fonte.Close === "function") {
                try { fonte.Close() } catch (error) { /* já fechada */ }
            }
        }

        ws.on("close", Encerrar)

        try {
            fonte = await WithAdapter(connectionId, (adaptador) => AbrirFonte(adaptador))
        } catch (error) {
            _EnviarNoSocket(ws, { type: "error", code: error.code, message: error.message })
            _FecharSocket(ws)
            return null
        }

        return { Encerrar }
    }

    const _LogStream = async (ws, { connectionId, containerIdOrName }) => {
        await _MontarStream(ws, connectionId, (adaptador) =>
            adaptador.StreamContainerLogs({
                containerIdOrName,
                tail: 200,
                onData: ({ stream, data }) => _EnviarNoSocket(ws, { type: "log", stream, data }),
                onError: (error) => {
                    _EnviarNoSocket(ws, { type: "error", message: error.message })
                    _FecharSocket(ws)
                },
                onEnd: () => {
                    _EnviarNoSocket(ws, { type: "end" })
                    _FecharSocket(ws)
                }
            }))
    }

    const _StatsStream = async (ws, { connectionId, containerIdOrName }) => {
        await _MontarStream(ws, connectionId, (adaptador) =>
            adaptador.StreamContainerStats({
                containerIdOrName,
                onData: (amostra) => _EnviarNoSocket(ws, { type: "stats", ...amostra }),
                onError: (error) => {
                    _EnviarNoSocket(ws, { type: "error", message: error.message })
                    _FecharSocket(ws)
                },
                onEnd: () => {
                    _EnviarNoSocket(ws, { type: "end" })
                    _FecharSocket(ws)
                }
            }))
    }

    /*
        O terminal é o único stream de mão dupla: o que o operador digita chega
        por `ws.on("message")` e vai para a entrada do processo dentro do
        container. Mensagem em JSON com `type`, para caber teclado e
        redimensionamento no mesmo canal.
    */
    const _ExecSession = async (ws, { connectionId, containerIdOrName }) => {
        let sessao = null

        const montagem = await _MontarStream(ws, connectionId, async (adaptador) => {
            sessao = await adaptador.OpenExecSession({
                containerIdOrName,
                onData: (texto) => _EnviarNoSocket(ws, { type: "output", data: texto }),
                onError: (error) => {
                    _EnviarNoSocket(ws, { type: "error", message: error.message })
                    _FecharSocket(ws)
                },
                onEnd: () => {
                    _EnviarNoSocket(ws, { type: "end" })
                    _FecharSocket(ws)
                }
            })
            return sessao
        })

        if (!montagem) return

        _EnviarNoSocket(ws, { type: "ready" })

        ws.on("message", (bruto) => {
            if (!sessao) return
            const texto = typeof bruto === "string" ? bruto : bruto.toString()

            let mensagem
            try {
                mensagem = JSON.parse(texto)
            } catch (error) {
                // Sem JSON: trata como digitação pura, que é o uso dominante.
                sessao.Write(texto)
                return
            }

            if (mensagem.type === "input") sessao.Write(mensagem.data || "")
            else if (mensagem.type === "resize") sessao.Resize({ cols: mensagem.cols, rows: mensagem.rows })
            else if (mensagem.type === "close") _FecharSocket(ws)
        })
    }

    const controllerServiceObject = {
        controllerName: "ContainersController",
        ListContainers: _ListContainers,
        InspectContainer: _InspectContainer,
        GetContainerLogHistory: _GetContainerLogHistory,
        StartContainer: _StartContainer,
        StopContainer: _StopContainer,
        RestartContainer: _RestartContainer,
        KillContainer: _KillContainer,
        RemoveContainer: _RemoveContainer,
        CreateContainer: _CreateContainer,
        LogStream: _LogStream,
        StatsStream: _StatsStream,
        ExecSession: _ExecSession
    }

    return controllerServiceObject
}

module.exports = ContainersController
