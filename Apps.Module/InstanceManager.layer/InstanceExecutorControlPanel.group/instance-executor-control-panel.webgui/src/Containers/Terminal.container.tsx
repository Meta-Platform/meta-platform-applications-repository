import * as React                        from "react"
import { useEffect, useRef, useState }    from "react"
import { Terminal }                       from "@xterm/xterm"
import { FitAddon }                       from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { Input, Button, Segment, Label }  from "semantic-ui-react"

import GetAPI from "../Utils/GetAPI"

// Terminal embutido para executar pacotes CLI através do daemon.
// Fluxo: RunPackage (HTTP) -> terminalId -> TerminalStream (WS) <-> xterm.
const TerminalContainer = ({ serverManagerInformation }:any) => {

    const termElementRef = useRef<HTMLDivElement>(null)
    const termRef        = useRef<any>(null)
    const fitRef         = useRef<any>(null)
    const wsRef          = useRef<any>(null)
    const terminalIdRef  = useRef<string | null>(null)
    const resizeRef      = useRef<any>(null)

    const [ packagePath, setPackagePath ]         = useState<string>("")
    const [ commandLineArgs, setCommandLineArgs ] = useState<string>("")
    const [ status, setStatus ]                   = useState<string>("idle") // idle | running | exited | error

    const getCliAPI = () => GetAPI({ apiName: "CommandLineRuntime", serverManagerInformation })

    const _cleanup = () => {
        if(resizeRef.current){ window.removeEventListener("resize", resizeRef.current); resizeRef.current = null }
        try { wsRef.current && wsRef.current.close() } catch(e){}
        wsRef.current = null
        try { termRef.current && termRef.current.dispose() } catch(e){}
        termRef.current = null
        terminalIdRef.current = null
    }

    useEffect(() => () => _cleanup(), [])

    const handleRun = async () => {
        if(!packagePath) return
        _cleanup()

        const term = new Terminal({ convertEol: true, fontFamily: "monospace", fontSize: 13, cursorBlink: true })
        const fit  = new FitAddon()
        term.loadAddon(fit)
        term.open(termElementRef.current as HTMLDivElement)
        try { fit.fit() } catch(e){}
        termRef.current = term
        fitRef.current  = fit

        setStatus("running")

        let terminalId:string | undefined
        try {
            const { data } = await getCliAPI().RunPackage({ packagePath, commandLineArgs, cols: term.cols, rows: term.rows })
            terminalId = data && data.terminalId
        } catch(e:any) {
            term.writeln(`\x1b[31m[erro ao iniciar]\x1b[0m ${e?.message || e}`)
            setStatus("error")
            return
        }
        if(!terminalId){
            term.writeln("\x1b[31m[erro] terminalId ausente na resposta\x1b[0m")
            setStatus("error")
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
                setStatus("exited")
            }
            else if(msg.type === "error")
                term.writeln(`\r\n\x1b[31m[erro] ${msg.message}\x1b[0m`)
        }
        ws.onclose = () => setStatus((s) => (s === "running" ? "exited" : s))

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

    const handleKill = () => {
        const terminalId = terminalIdRef.current
        if(!terminalId) return
        try { getCliAPI().Kill({ terminalId }) } catch(e){}
    }

    return <Segment basic style={{ paddingTop: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Input
                        placeholder="Caminho do pacote CLI"
                        value={packagePath}
                        onChange={(e:any) => setPackagePath(e.target.value)}
                        style={{ minWidth: 420 }} />
                    <Input
                        placeholder="argumentos (ex: tasks)"
                        value={commandLineArgs}
                        onChange={(e:any) => setCommandLineArgs(e.target.value)} />
                    <Button primary onClick={handleRun}>Executar</Button>
                    <Button basic onClick={handleKill} disabled={status !== "running"}>Encerrar</Button>
                    <Label>{status}</Label>
                </div>
                <div
                    ref={termElementRef}
                    style={{ marginTop: 12, height: 480, background: "#000", padding: 6 }} />
            </Segment>
}

export default TerminalContainer
