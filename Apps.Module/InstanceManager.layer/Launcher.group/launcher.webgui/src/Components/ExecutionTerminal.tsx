import * as React from "react"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"

import { Button, StatusChip, TextInput } from "@i-components"

import GetAPI from "../Utils/GetAPI"

// Terminal de execução de um pacote CLI, ligado ao terminal real (node-pty) do
// daemon. Fluxo: RunPackage (HTTP) → terminalId → TerminalStream (WS) ↔ xterm.
//
// O caminho do pacote pode vir fixo (packagePath, quando lançado do Launcher) ou
// ser digitado pelo usuário (editablePath, no terminal avulso).
//
// Os controles embutidos (args livres + executar/encerrar) podem ser escondidos
// com `showControls={false}`: aí quem dispara é o form de comandos, pela ref
// (Run/Kill). O estado é reportado por `onStatusChange`.
export type ExecutionTerminalHandle = {
    Run  : (commandLineArgs?:string) => Promise<void>
    Kill : () => void
}

const ExecutionTerminal = forwardRef<ExecutionTerminalHandle, any>(({
    serverManagerInformation,
    packagePath: fixedPackagePath,
    editablePath = false,
    height = 480,
    autoRun = false,
    showControls = true,
    onStatusChange
}:any, ref) => {

    const termElementRef = useRef<HTMLDivElement>(null)
    const termRef        = useRef<any>(null)
    const wsRef          = useRef<any>(null)
    const terminalIdRef  = useRef<string | null>(null)
    const resizeRef      = useRef<any>(null)

    const [ typedPath, setTypedPath ]             = useState<string>("")
    const [ commandLineArgs, setCommandLineArgs ] = useState<string>("")
    const [ status, setStatus ]                   = useState<string>("idle") // idle | running | exited | error

    // O status também vive num ref: os callbacks do WebSocket precisam lê-lo sem
    // recriar os handlers a cada render.
    const statusRef = useRef<string>("idle")

    const packagePath = editablePath ? typedPath : fixedPackagePath

    const getCliAPI = () => GetAPI({ apiName: "CommandLineRuntime", serverManagerInformation })

    const _changeStatus = (next:string) => {
        statusRef.current = next
        setStatus(next)
        if(onStatusChange) onStatusChange(next)
    }

    const _cleanup = () => {
        if(resizeRef.current){ window.removeEventListener("resize", resizeRef.current); resizeRef.current = null }
        try { wsRef.current && wsRef.current.close() } catch(e){}
        wsRef.current = null
        try { termRef.current && termRef.current.dispose() } catch(e){}
        termRef.current = null
        terminalIdRef.current = null
    }

    useEffect(() => () => _cleanup(), [])

    // Ao trocar o pacote alvo, encerra o terminal anterior — senão o xterm
    // antigo continua montado exibindo a saída de outro pacote.
    useEffect(() => {
        _cleanup()
        _changeStatus("idle")
    }, [fixedPackagePath])

    // `argsOverride` vem do form de comandos; sem ele vale o input de args livres.
    const handleRun = async (argsOverride?:string) => {
        if(!packagePath) return
        _cleanup()

        const args = argsOverride !== undefined ? argsOverride : commandLineArgs

        const term = new Terminal({ convertEol: true, fontFamily: "monospace", fontSize: 13, cursorBlink: true })
        const fit  = new FitAddon()
        term.loadAddon(fit)
        term.open(termElementRef.current as HTMLDivElement)
        try { fit.fit() } catch(e){}
        termRef.current = term

        _changeStatus("running")

        let terminalId:string | undefined
        try {
            const { data } = await getCliAPI().RunPackage({ packagePath, commandLineArgs: args, cols: term.cols, rows: term.rows })
            terminalId = data && data.terminalId
        } catch(e:any) {
            term.writeln(`\x1b[31m[erro ao iniciar]\x1b[0m ${e?.message || e}`)
            _changeStatus("error")
            return
        }
        if(!terminalId){
            term.writeln("\x1b[31m[erro] terminalId ausente na resposta\x1b[0m")
            _changeStatus("error")
            return
        }
        terminalIdRef.current = terminalId

        const ws = getCliAPI().TerminalStream({ terminalId })
        wsRef.current = ws

        ws.onmessage = (event:any) => {
            let msg:any
            try { msg = JSON.parse(event.data) } catch(e){ return }
            if(msg.type === "data")
                term.write(msg.data)
            else if(msg.type === "exit"){
                term.writeln(`\r\n\x1b[33m[processo encerrado — código ${msg.exitCode}]\x1b[0m`)
                _changeStatus("exited")
            }
            else if(msg.type === "error")
                term.writeln(`\r\n\x1b[31m[erro] ${msg.message}\x1b[0m`)
        }
        // O `exit` do PTY já move para "exited"; aqui cobrimos a queda do socket.
        ws.onclose = () => { if(statusRef.current === "running") _changeStatus("exited") }

        // Entrada do usuário -> daemon.
        term.onData((d:string) => {
            try { ws.send(JSON.stringify({ type: "input", data: d })) } catch(e){}
        })

        // Redimensionamento -> mantém o layout do CLI correto.
        const doResize = () => {
            try {
                fit.fit()
                ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
            } catch(e){}
        }
        resizeRef.current = doResize
        window.addEventListener("resize", doResize)
    }

    // autoRun dispara uma única vez por pacote alvo.
    const autoRunRef = useRef<string>()
    useEffect(() => {
        if(!autoRun || !packagePath) return
        if(autoRunRef.current === packagePath) return
        autoRunRef.current = packagePath
        handleRun()
    }, [autoRun, packagePath])

    const handleKill = () => {
        const terminalId = terminalIdRef.current
        if(!terminalId) return
        try { getCliAPI().Kill({ terminalId }) } catch(e){}
    }

    useImperativeHandle(ref, () => ({ Run: handleRun, Kill: handleKill }))

    // Estados locais do terminal (não são status de instância do daemon), então
    // a apresentação sai do StatusChip do kit, com tom e ícone por estado.
    const STATUS_TONE:any = { idle: "neutral", running: "warning", exited: "neutral", error: "danger" }
    const STATUS_ICON:any = {
        idle    : "clock outline",
        running : "spinner",
        exited  : "check circle outline",
        error   : "times circle"
    }

    const isFinished = status === "exited" || status === "error"

    return <div className="lnc-terminal-block">
        {
            showControls &&
            <div className="lnc-terminal-controls">
                {
                    editablePath &&
                    <TextInput
                        className="lnc-terminal-path"
                        placeholder="Caminho do pacote CLI"
                        value={typedPath}
                        onChange={(event:any) => setTypedPath(event.target.value)}/>
                }
                <TextInput
                    className="lnc-terminal-args"
                    placeholder="argumentos (ex: tasks)"
                    value={commandLineArgs}
                    onChange={(event:any) => setCommandLineArgs(event.target.value)}/>
                <Button
                    variant="primary"
                    icon={isFinished ? "redo" : "play"}
                    onClick={() => handleRun()}
                    disabled={!packagePath}>
                    { isFinished ? "Executar de novo" : "Executar" }
                </Button>
                <Button icon="stop" onClick={handleKill} disabled={status !== "running"}>
                    Encerrar
                </Button>
                <StatusChip label={status} tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}/>
            </div>
        }
        <div ref={termElementRef} className="lnc-terminal-screen" style={{ height }}/>
    </div>
})

export default ExecutionTerminal
