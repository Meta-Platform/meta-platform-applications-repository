import * as React from "react"
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"

import { Button, StatusChip, TextInput } from "@i-components"
import { Terminal } from "@i-components/components/advanced/runtime"
import type { TerminalHandle, TerminalSize } from "@i-components/components/advanced/runtime"

import { GetAPI } from "@i-components/net"

// Terminal de execução de um pacote CLI, ligado ao terminal real (node-pty) do
// daemon. Fluxo: RunPackage (HTTP) → terminalId → TerminalStream (WS) ↔ xterm.
//
// O EMULADOR é o `Terminal` do kit, que nasceu deste componente: xterm, ajuste
// de tamanho, limpeza de recursos e — o que aqui não existia — a paleta vinda
// dos tokens --mp-terminal-*, que segue o tema. O que ficou é o domínio: o
// protocolo do daemon (RunPackage/TerminalStream/Kill) e os controles de
// execução.
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

    const termRef        = useRef<TerminalHandle>(null)
    const wsRef          = useRef<any>(null)
    const terminalIdRef  = useRef<string | null>(null)

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

    // Só o SOCKET é descartado: o emulador fica montado (é ele que guarda o
    // histórico da tela) e é reiniciado com `Reset` a cada execução nova.
    const _closeStream = () => {
        try { wsRef.current && wsRef.current.close() } catch(e){}
        wsRef.current = null
        terminalIdRef.current = null
    }

    useEffect(() => () => _closeStream(), [])

    // Ao trocar o pacote alvo, encerra o stream anterior e limpa a tela — senão
    // fica exibindo a saída de outro pacote.
    useEffect(() => {
        _closeStream()
        termRef.current && termRef.current.Reset()
        _changeStatus("idle")
    }, [fixedPackagePath])

    // `argsOverride` vem do form de comandos; sem ele vale o input de args livres.
    const handleRun = async (argsOverride?:string) => {
        if(!packagePath) return
        _closeStream()

        const term = termRef.current
        if(!term) return

        const args = argsOverride !== undefined ? argsOverride : commandLineArgs

        term.Reset()
        term.Fit()

        _changeStatus("running")

        const { cols, rows } = term.Size()

        let terminalId:string | undefined
        try {
            const { data } = await getCliAPI().RunPackage({ packagePath, commandLineArgs: args, cols, rows })
            terminalId = data && data.terminalId
        } catch(e:any) {
            term.WriteLine(`\x1b[31m[erro ao iniciar]\x1b[0m ${e?.message || e}`)
            _changeStatus("error")
            return
        }
        if(!terminalId){
            term.WriteLine("\x1b[31m[erro] terminalId ausente na resposta\x1b[0m")
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
                term.Write(msg.data)
            else if(msg.type === "exit"){
                term.WriteLine(`\r\n\x1b[33m[processo encerrado — código ${msg.exitCode}]\x1b[0m`)
                _changeStatus("exited")
            }
            else if(msg.type === "error")
                term.WriteLine(`\r\n\x1b[31m[erro] ${msg.message}\x1b[0m`)
        }
        // O `exit` do PTY já move para "exited"; aqui cobrimos a queda do socket.
        ws.onclose = () => { if(statusRef.current === "running") _changeStatus("exited") }
    }

    // Entrada do usuário -> daemon.
    const _onData = (data:string) => {
        try { wsRef.current && wsRef.current.send(JSON.stringify({ type: "input", data })) } catch(e){}
    }

    // O emulador do kit observa o PRÓPRIO elemento, então este aviso chega
    // também quando é o painel ao lado que muda de tamanho — e não só a janela.
    const _onResize = ({ cols, rows }:TerminalSize) => {
        try { wsRef.current && wsRef.current.send(JSON.stringify({ type: "resize", cols, rows })) } catch(e){}
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
        <Terminal
            ref={termRef}
            className="lnc-terminal-screen"
            height={height}
            label="terminal de execução do pacote"
            onData={_onData}
            onResize={_onResize}/>
    </div>
})

export default ExecutionTerminal
