import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Icon, TextInput } from "@i-components"

import IPCWebSocket from "../Utils/IPCWebSocket"


const stripAnsi = (s:string) => s.replace(/\x1b\[[0-9;]*m/g, "")

// Apresentação de terminal: `.pdx-terminal` (Styles/components.css),
// cores nos tokens --mp-terminal-*. A altura continua vindo por prop.
const STREAM_CLASS:any = { stderr: "stderr", system: "system", stdin: "stdin" }

type Entry = { stream:string, line:string, ts?:number }

const PackageConsole = ({ workspace, packageSelected, terminalHeight = "46vh" }:any) => {

    const [lines, setLines]     = useState<Entry[]>([])
    const [status, setStatus]   = useState<"connecting"|"open"|"closed">("connecting")
    const [command, setCommand] = useState("")

    const wsRef    = useRef<any>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    const buildUrl = () => {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
        const qs = `workspace=${encodeURIComponent(workspace)}`
            + `&packageName=${encodeURIComponent(packageSelected.name)}`
            + `&type=${encodeURIComponent(packageSelected.ext)}`
        return `${proto}//${window.location.host}/package-tasks/console?${qs}`
    }

    const connect = () => {
        setLines([])
        setStatus("connecting")
        // Electron GUI-host: console via canal de streaming IPC (IPCWebSocket),
        // no lugar de um WebSocket HTTP baseado em window.location. Mesma API,
        // incluindo stdin (ws.send). Fora do Electron, WebSocket normal.
        const ws = (typeof window !== "undefined" && (window as any).metaGui)
            ? new IPCWebSocket("PackageTasks", "Console", {
                  workspace,
                  packageName: packageSelected.name,
                  type: packageSelected.ext
              })
            : new WebSocket(buildUrl())
        wsRef.current = ws
        ws.onopen    = () => setStatus("open")
        ws.onclose   = () => setStatus("closed")
        ws.onerror   = () => setStatus("closed")
        ws.onmessage = (event) => {
            try {
                const entry = JSON.parse(event.data)
                setLines((prev) => [...prev.slice(-4000), entry])
            } catch(e) { /* ignora */ }
        }
    }

    useEffect(() => {
        connect()
        return () => { wsRef.current && wsRef.current.close() }
    }, [workspace, packageSelected && packageSelected.name, packageSelected && packageSelected.ext])

    useEffect(() => {
        const el = panelRef.current
        if(el) el.scrollTop = el.scrollHeight
    }, [lines])

    const sendCommand = () => {
        const ws = wsRef.current
        if(ws && ws.readyState === WebSocket.OPEN && command.length > 0){
            ws.send(command)
            setCommand("")
        }
    }

    return <>
        <div style={{marginBottom:6}}>
            <span className={`pdx-console-status pdx-console-status--${status}`}>
                <Icon name="terminal" />{status === "open" ? "conectado" : status === "connecting" ? "conectando…" : "desconectado"}
            </span>
            { status === "closed" &&
                <a className="pdx-console-reconnect" onClick={connect}><Icon name="refresh" />reconectar</a> }
        </div>
        <div className="pdx-terminal" style={{height: terminalHeight}} ref={panelRef}>
            {
                lines.length === 0
                ? <span className="pdx-terminal__empty">sem saída — inicie o pacote (Run/Debug)</span>
                : lines.map((entry, key) =>
                    <div key={key} className={`pdx-terminal__line${STREAM_CLASS[entry.stream] ? ` pdx-terminal__line--${STREAM_CLASS[entry.stream]}` : ""}`}>
                        {entry.stream === "stdin" ? "» " : ""}{stripAnsi(entry.line)}
                    </div>)
            }
        </div>
        <div className="pdx-console-input">
            <Icon name="angle right" className="pdx-console-input__icon" />
            <TextInput
                className="pdx-console-input__el"
                placeholder="digite e Enter para enviar ao stdin do processo…"
                value={command}
                disabled={status !== "open"}
                onChange={(e:any) => setCommand(e.target.value)}
                onKeyDown={(e:any) => { if(e.key === "Enter") sendCommand() }} />
        </div>
    </>
}

export default PackageConsole
