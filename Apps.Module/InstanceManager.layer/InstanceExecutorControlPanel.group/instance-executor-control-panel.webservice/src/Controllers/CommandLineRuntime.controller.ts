// Controller-ponte de execução de pacotes CLI (terminal) do painel.
//
// Proxeia o daemon `executor-manager` (via command-line-runtime.service →
// instance-manager-client.lib). O navegador nunca fala com o socket do daemon
// diretamente: aqui fazemos a ponte HTTP/WS ↔ daemon.
const CommandLineRuntimeController = (params: any) => {

    const {
        commandLineRuntimeService: {
            RunCommandLinePackage,
            ListTerminals,
            KillTerminal,
            OpenTerminalStream
        }
    } = params

    const RunPackage = ({ packagePath, commandLineArgs, cols, rows }: any) =>
        RunCommandLinePackage({ packagePath, commandLineArgs, cols, rows })

    const List = () => ListTerminals()

    // 1 parâmetro (terminalId) chega como valor direto (contrato do server-manager).
    const Kill = (terminalId: any) => KillTerminal({ terminalId })

    // Ponte WebSocket bidirecional: navegador <-> stream de terminal do daemon.
    // As mensagens são repassadas cruas nos dois sentidos (o protocolo
    // {type:"data"|"exit"} / {type:"input"|"resize"} é do daemon e do xterm).
    const TerminalStream = async (ws: any, terminalId: any) => {

        const _safeSend = (payload: any) => {
            try { ws.send(typeof payload === "string" ? payload : JSON.stringify(payload)) } catch(e: any){}
        }

        let daemonWs
        try {
            daemonWs = await OpenTerminalStream({ terminalId })
        } catch(error: any) {
            _safeSend({ type: "error", message: (error && error.message) || String(error) })
            try { ws.close() } catch(e: any){}
            return
        }

        // Bufferiza o input do navegador até o socket do daemon abrir.
        const pending: any[] = []
        let daemonOpen = false
        const _flush = () => { while(pending.length) { try { daemonWs.send(pending.shift()) } catch(e: any){} } }

        daemonWs.on("open",    () => { daemonOpen = true; _flush() })
        daemonWs.on("message", (data: any) => _safeSend(data.toString()))
        daemonWs.on("close",   () => { try { ws.close() } catch(e: any){} })
        daemonWs.on("error",   (error: any) => _safeSend({ type: "error", message: (error && error.message) || String(error) }))

        ws.on && ws.on("message", (raw: any) => {
            const text = raw.toString()
            if(daemonOpen) { try { daemonWs.send(text) } catch(e: any){} }
            else pending.push(text)
        })

        ws.on && ws.on("close", () => { try { daemonWs.close() } catch(e: any){} })
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
