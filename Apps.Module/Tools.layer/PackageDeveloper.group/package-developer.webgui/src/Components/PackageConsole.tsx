import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Input, Label, Icon } from "semantic-ui-react"
import styled from "styled-components"

const stripAnsi = (s:string) => s.replace(/\x1b\[[0-9;]*m/g, "")

const Terminal = styled.div<{h:string}>`
    height: ${({h}) => h};
    overflow: auto;
    background: #101418;
    color: #d4d4d4;
    font-family: "Menlo", "Monaco", "Consolas", monospace;
    font-size: 12px;
    line-height: 1.45;
    padding: 10px;
    border-radius: 4px 4px 0 0;
    white-space: pre-wrap;
    word-break: break-word;
`

const Line = styled.div<{stream:string}>`
    color: ${({stream}) =>
        stream === "stderr" ? "#f48771"
        : stream === "system" ? "#569cd6"
        : stream === "stdin" ? "#4ec9b0"
        : "#d4d4d4"};
`

type Entry = { stream:string, line:string, ts?:number }

const PackageConsole = ({ workspace, packageSelected, terminalHeight = "46vh" }:any) => {

    const [lines, setLines]     = useState<Entry[]>([])
    const [status, setStatus]   = useState<"connecting"|"open"|"closed">("connecting")
    const [command, setCommand] = useState("")

    const wsRef    = useRef<WebSocket | null>(null)
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
        const ws = new WebSocket(buildUrl())
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

    const statusColor:any = { connecting: "yellow", open: "green", closed: "grey" }

    return <>
        <div style={{marginBottom:6}}>
            <Label size="small" color={statusColor[status]}>
                <Icon name="terminal" />{status === "open" ? "conectado" : status === "connecting" ? "conectando…" : "desconectado"}
            </Label>
            { status === "closed" &&
                <a style={{marginLeft:8, cursor:"pointer"}} onClick={connect}><Icon name="refresh" />reconectar</a> }
        </div>
        <Terminal h={terminalHeight} ref={panelRef}>
            {
                lines.length === 0
                ? <span style={{opacity:0.4}}>sem saída — inicie o pacote (Run/Debug)</span>
                : lines.map((entry, key) =>
                    <Line key={key} stream={entry.stream}>
                        {entry.stream === "stdin" ? "» " : ""}{stripAnsi(entry.line)}
                    </Line>)
            }
        </Terminal>
        <Input
            fluid
            size="small"
            placeholder="digite e Enter para enviar ao stdin do processo…"
            value={command}
            disabled={status !== "open"}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e:any) => { if(e.key === "Enter") sendCommand() }}
            icon={{ name: "angle right" }}
            iconPosition="left"
            style={{fontFamily:"monospace"}} />
    </>
}

export default PackageConsole
