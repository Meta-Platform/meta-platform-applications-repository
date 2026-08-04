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
        MÉTRICAS DE VÁRIOS CONTAINERS NUM SOCKET SÓ.

        A tela de aplicações mostra dezenas de cartões, cada um com memória e
        CPU. Um socket por cartão parece natural e não funciona: o navegador
        limita as conexões simultâneas por host (~6 em HTTP/1.1), e a partir do
        sétimo cartão as métricas simplesmente não chegam — a fila nunca anda,
        porque nenhum stream termina.

        O sintoma foi exatamente esse: no modo janela (IPC, sem esse limite)
        todos os cartões preenchiam; na web, só os primeiros.

        Aqui o cliente manda a lista de containers que quer acompanhar
        (`{type:"watch", containers:[...]}`) e recebe tudo por um canal só,
        com `containerId` em cada amostra. Trocar a lista fecha o que saiu e
        abre o que entrou — a tela pode filtrar sem reabrir conexão.
    */
    const _MultiStatsStream = async (ws, connectionId) => {
        const fontes = new Map()
        let fechado = false

        const FecharTudo = () => {
            fechado = true
            fontes.forEach((fonte) => {
                try { fonte.Close() } catch (error) { /* já fechada */ }
            })
            fontes.clear()
        }

        ws.on("close", FecharTudo)

        const Acompanhar = async (containerId) => {
            if (fechado || fontes.has(containerId)) return
            try {
                const fonte = await WithAdapter(connectionId, (adaptador) =>
                    adaptador.StreamContainerStats({
                        containerIdOrName: containerId,
                        onData: (amostra) => _EnviarNoSocket(ws, { type: "stats", containerId, ...amostra }),
                        onError: () => {
                            // Um container que morre não pode derrubar as
                            // métricas dos outros: fecha só a fonte dele.
                            const morta = fontes.get(containerId)
                            if (morta) { try { morta.Close() } catch (error) { /* já fechada */ } }
                            fontes.delete(containerId)
                            _EnviarNoSocket(ws, { type: "stats-ended", containerId })
                        },
                        onEnd: () => {
                            fontes.delete(containerId)
                            _EnviarNoSocket(ws, { type: "stats-ended", containerId })
                        }
                    }))
                if (fechado) { try { fonte.Close() } catch (error) { /* corrida com o fechamento */ } ; return }
                fontes.set(containerId, fonte)
            } catch (error) {
                _EnviarNoSocket(ws, { type: "stats-error", containerId, message: error.message })
            }
        }

        const Esquecer = (containerId) => {
            const fonte = fontes.get(containerId)
            if (!fonte) return
            try { fonte.Close() } catch (error) { /* já fechada */ }
            fontes.delete(containerId)
        }

        ws.on("message", async (bruto) => {
            const texto = typeof bruto === "string" ? bruto : bruto.toString()
            let mensagem
            try {
                mensagem = JSON.parse(texto)
            } catch (error) {
                return
            }

            if (mensagem.type !== "watch") return

            const desejados = Array.isArray(mensagem.containers) ? mensagem.containers : []

            Array.from(fontes.keys())
                .filter((containerId) => !desejados.includes(containerId))
                .forEach(Esquecer)

            for (const containerId of desejados) await Acompanhar(containerId)
        })

        _EnviarNoSocket(ws, { type: "ready" })
    }

    /*
        O terminal é o único stream de mão dupla: o que o operador digita chega
        por `ws.on("message")` e vai para a entrada do processo dentro do
        container. Mensagem em JSON com `type`, para caber teclado e
        redimensionamento no mesmo canal.
    */
    /*
        O adaptador sempre aceitou `cmd`, `user`, `workingDir`, `cols` e `rows`
        — o controller é que não repassava nenhum deles (CTMG-82). O resultado:
        não havia como abrir um terminal como root nem escolher o shell, e o
        tamanho ficava travado em 80x24 mesmo numa janela grande, quebrando a
        exibição de tudo que desenha em tela cheia.
    */
    const _ExecSession = async (ws, {
        connectionId, containerIdOrName, cmd, user, workingDir, cols, rows
    }) => {
        let sessao = null

        // O comando chega como texto na query; o adaptador espera lista.
        const comando = Array.isArray(cmd)
            ? cmd
            : (typeof cmd === "string" && cmd.trim() !== "" ? ["/bin/sh", "-c", cmd] : undefined)

        const montagem = await _MontarStream(ws, connectionId, async (adaptador) => {
            sessao = await adaptador.OpenExecSession({
                containerIdOrName,
                ...(comando ? { cmd: comando } : {}),
                ...(user ? { user } : {}),
                ...(workingDir ? { workingDir } : {}),
                ...(cols ? { cols: Number(cols) } : {}),
                ...(rows ? { rows: Number(rows) } : {}),
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

    /*
        ARQUIVOS DENTRO DO CONTAINER (CTMG-84).

        Repasse direto ao adaptador, que é quem decide entre exec (container
        rodando) e leitura do tar (container parado) — a tela recebe a mesma
        forma nos dois casos e não precisa saber a diferença.
    */
    const _ListContainerEntries = async ({ connectionId, containerIdOrName, path }) =>
        await WithAdapter(connectionId, (a) => a.ListContainerEntries({ containerIdOrName, path }))

    const _CopyFromContainer = async ({ connectionId, containerIdOrName, path }) =>
        await WithAdapter(connectionId, (a) => a.CopyFromContainer({ containerIdOrName, path }))

    const _CopyToContainer = async ({ connectionId, containerIdOrName, path, fileName, contentBase64 }) =>
        await WithAdapter(connectionId, (a) =>
            a.CopyToContainer({ containerIdOrName, path, fileName, contentBase64 }))

    const _DeleteContainerEntry = async ({ connectionId, containerIdOrName, path }) =>
        await WithAdapter(connectionId, (a) => a.DeleteContainerEntry({ containerIdOrName, path }))

    const _MakeContainerDirectory = async ({ connectionId, containerIdOrName, path }) =>
        await WithAdapter(connectionId, (a) => a.MakeContainerDirectory({ containerIdOrName, path }))

    const controllerServiceObject = {
        controllerName: "ContainersController",
        ListContainerEntries: _ListContainerEntries,
        CopyFromContainer: _CopyFromContainer,
        CopyToContainer: _CopyToContainer,
        DeleteContainerEntry: _DeleteContainerEntry,
        MakeContainerDirectory: _MakeContainerDirectory,
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
        MultiStatsStream: _MultiStatsStream,
        ExecSession: _ExecSession
    }

    return controllerServiceObject
}

module.exports = ContainersController
