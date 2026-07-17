// Controller-ponte de execução de pacotes CLI (terminal) do painel.
//
// Proxeia o daemon `executor-manager` (via command-line-runtime.service →
// instance-manager-client.lib). O navegador nunca fala com o socket do daemon
// diretamente: aqui fazemos a ponte HTTP/WS ↔ daemon.
const CommandLineRuntimeController = (params) => {

    const {
        commandLineRuntimeService: {
            RunCommandLinePackage,
            ListTerminals,
            KillTerminal,
            OpenTerminalStream
        }
    } = params

    const RunPackage = ({ packagePath, commandLineArgs, cols, rows }) =>
        RunCommandLinePackage({ packagePath, commandLineArgs, cols, rows })

    const List = () => ListTerminals()

    // 1 parâmetro (terminalId) chega como valor direto (contrato do server-manager).
    const Kill = (terminalId) => KillTerminal({ terminalId })

    // Ponte WebSocket bidirecional: navegador <-> stream de terminal do daemon.
    // As mensagens são repassadas cruas nos dois sentidos (o protocolo
    // {type:"data"|"exit"} / {type:"input"|"resize"} é do daemon e do xterm).
    const TerminalStream = async (ws, terminalId) => {

        const _safeSend = (payload) => {
            try { ws.send(typeof payload === "string" ? payload : JSON.stringify(payload)) } catch(e){}
        }

        let daemonWs
        try {
            daemonWs = await OpenTerminalStream({ terminalId })
        } catch(error) {
            _safeSend({ type: "error", message: (error && error.message) || String(error) })
            try { ws.close() } catch(e){}
            return
        }

        // Bufferiza o input do navegador até o socket do daemon abrir.
        const pending = []
        let daemonOpen = false
        const _flush = () => { while(pending.length) { try { daemonWs.send(pending.shift()) } catch(e){} } }

        daemonWs.on("open",    () => { daemonOpen = true; _flush() })
        daemonWs.on("message", (data) => _safeSend(data.toString()))
        daemonWs.on("close",   () => { try { ws.close() } catch(e){} })
        daemonWs.on("error",   (error) => _safeSend({ type: "error", message: (error && error.message) || String(error) }))

        ws.on && ws.on("message", (raw) => {
            const text = raw.toString()
            if(daemonOpen) { try { daemonWs.send(text) } catch(e){} }
            else pending.push(text)
        })

        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e){} })
    }

    return Object.freeze({
        controllerName: "CommandLineRuntimeController",
        RunPackage,
        List,
        Kill,
        TerminalStream
    })
}

module.exports = CommandLineRuntimeController
