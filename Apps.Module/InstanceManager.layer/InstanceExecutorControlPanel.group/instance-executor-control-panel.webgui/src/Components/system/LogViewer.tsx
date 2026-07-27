import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Icon } from "semantic-ui-react"

import useWebSocket from "../../Hooks/useWebSocket"
import GetAPI from "../../Utils/GetAPI"
import { SearchField } from "./Indicators"
import { FormatBytes } from "./Format"

/**
 * Log de uma instância, ao vivo.
 *
 * O daemon já gravava esse log em disco — era o único lugar que respondia "por
 * que essa instância morreu" — e não havia como lê-lo sem abrir um terminal e
 * conhecer o instanceId. Aqui ele vira uma aba do painel.
 *
 * O stream manda um snapshot na conexão e, depois, só os incrementos. Este
 * componente acumula; o daemon não reenvia o que já foi entregue.
 *
 * Deve ser montado com key={instanceId} para reconectar ao trocar de instância.
 */

// Teto de linhas em memória. Um desktop de sessão longa escreve dezenas de
// milhares; o DOM não aguenta e ninguém rola até lá. O corte é pela frente, que
// é o lado velho.
const MAX_LINES = 4000

const CLASS_BY_PATTERN = [
    { pattern: /\b(error|erro|exception|fatal|failed|falha)\b/i, className: "iep-log__line--error" },
    { pattern: /\b(warn|warning|aviso|deprecated)\b/i,           className: "iep-log__line--warn" },
    { pattern: /^\[[^\]]+\]\s*\[daemon\]/,                       className: "iep-log__line--daemon" }
]

const _LineClass = (line: string) => {
    const match = CLASS_BY_PATTERN.find((entry) => entry.pattern.test(line))
    return match ? match.className : ""
}

const LogViewer = ({ instance, serverManagerInformation, height }: any) => {

    const [ lines, setLines ]     = useState<string[]>([])
    const [ filter, setFilter ]   = useState("")
    const [ follow, setFollow ]   = useState(true)
    const [ size, setSize ]       = useState<number>()
    const [ connected, setConnected ] = useState(false)
    const [ dropped, setDropped ] = useState(0)

    const bodyRef = useRef<HTMLDivElement>(null)

    const instanceId = instance && instance.instanceId

    const getObservabilityAPI = () =>
        GetAPI({ apiName: "InstanceObservability", serverManagerInformation })

    const _Append = (incoming: string[], replace: boolean) => {
        setLines((current) => {
            const merged = replace ? incoming : [...current, ...incoming]
            if (merged.length <= MAX_LINES) return merged
            setDropped((count) => count + (merged.length - MAX_LINES))
            return merged.slice(merged.length - MAX_LINES)
        })
    }

    useWebSocket({
        socket          : () => getObservabilityAPI().InstanceLogStream({ instanceId }),
        onMessage       : (message: any) => {
            if (!message) return
            // `rotated` = o arquivo foi truncado no daemon: o que está na tela
            // não é mais a continuação do que vem, então recomeça.
            _Append(message.lines || [], message.type === "snapshot" || message.rotated === true)
            if (message.size !== undefined) setSize(message.size)
            setConnected(true)
        },
        onConnection    : () => setConnected(true),
        onDisconnection : () => setConnected(false)
    })

    // Auto-scroll só enquanto o usuário quer acompanhar. Rolar para cima
    // desliga o follow — senão o log arrastaria a leitura de volta para o fim a
    // cada linha nova, que é a maneira mais rápida de tornar um log inútil.
    useEffect(() => {
        if (!follow || !bodyRef.current) return
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }, [lines, follow])

    const _OnScroll = () => {
        const element = bodyRef.current
        if (!element) return
        const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 24
        if (atBottom !== follow) setFollow(atBottom)
    }

    const visibleLines = useMemo(() => {
        if (!filter) return lines.map((line, index) => ({ line, index }))
        const needle = filter.toLowerCase()
        return lines
            .map((line, index) => ({ line, index }))
            .filter((entry) => entry.line.toLowerCase().includes(needle))
    }, [lines, filter])

    const _Copy = () => {
        try { navigator.clipboard.writeText(visibleLines.map((entry) => entry.line).join("\n")) } catch (e) {}
    }

    return <div className="iep-log" style={height ? { height, flex: "0 0 auto" } : undefined}>
        <div className="iep-log__bar">
            <SearchField value={filter} onChange={setFilter} placeholder="filtrar no log" width={200}/>

            <button
                type="button"
                className={`iep-btn${follow ? " iep-btn--active" : ""}`}
                title="rolar automaticamente conforme chegam linhas"
                onClick={() => setFollow((current) => !current)}>
                <Icon name="arrow down" style={{ margin: 0 }}/> acompanhar
            </button>

            <button type="button" className="iep-btn" onClick={() => { setLines([]); setDropped(0) }}>
                <Icon name="eraser" style={{ margin: 0 }}/> limpar
            </button>

            <button type="button" className="iep-btn" onClick={_Copy} disabled={visibleLines.length === 0}>
                <Icon name="copy outline" style={{ margin: 0 }}/> copiar
            </button>

            <span className="iep-toolbar__spacer"/>

            <span className="iep-log__meta">
                {filter ? `${visibleLines.length}/${lines.length}` : `${lines.length}`} linhas
                {size !== undefined ? ` · ${FormatBytes(size)}` : ""}
                {dropped > 0 ? ` · ${dropped} antigas descartadas` : ""}
                {" · "}
                <span style={{ color: connected ? "var(--mp-terminal-green)" : "var(--mp-terminal-orange)" }}>
                    {connected ? "ao vivo" : "desconectado"}
                </span>
            </span>
        </div>

        <div className="iep-log__body" ref={bodyRef} onScroll={_OnScroll}>
            {
                visibleLines.length === 0
                ? <div className="iep-log__empty">
                    {
                        lines.length === 0
                        ? "nenhuma linha registrada para esta instância ainda."
                        : "nenhuma linha corresponde ao filtro."
                    }
                </div>
                : visibleLines.map((entry) => <div
                    key={entry.index}
                    className={`iep-log__line ${_LineClass(entry.line)}`}>
                    <span className="iep-log__gutter">{entry.index + 1}</span>
                    <span className="iep-log__text">{entry.line}</span>
                </div>)
            }
        </div>
    </div>
}

export default LogViewer
