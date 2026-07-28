import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { AgentPresence, AgentNotice } from "../api/types"
import { Loading, EmptyState, ErrorBanner } from "./Primitives"
import { formatDateTime } from "../Utils/format"

// QUEM ESTÁ TRABALHANDO AGORA (MPMX3-15/16).
//
// A lista de sessões já existia e respondia outra pergunta: quem TEM permissão
// de escrever. Isso não diz se o agente ainda está lá, com o que ele está, nem o
// que ele diz estar fazendo — e é isso que o humano precisa para arbitrar quando
// duas sessões se atropelam no mesmo checkout.
//
// Junto vai a fita de AVISOS: entrada, saída, recado dirigido e mexida em
// ambiente compartilhado, na ordem em que aconteceram.

const PRESENCE_CHIP: Record<string, string> = {
    here: "mpm-chip--success",
    idle: "mpm-chip--warning",
    gone: "mpm-chip--neutral"
}
const PRESENCE_LABEL: Record<string, string> = {
    here: "trabalhando",
    idle: "parado",
    gone: "saiu"
}
const NOTICE_ICON: Record<string, string> = {
    joined: "sign-in",
    left: "sign-out",
    message: "comment",
    environment: "server",
    "item-touched": "hand paper"
}

interface Props { project?: string }

const AgentPresencePanel = ({ project }: Props) => {
    const api = useApi()
    const [sessions, setSessions] = useState<AgentPresence[] | null>(null)
    const [notices, setNotices] = useState<AgentNotice[]>([])
    const [error, setError] = useState<string | null>(null)

    const load = () => Promise.all([
        api.agents.whoIsHere({ project }),
        api.agents.listNotices({ project, limit: 12 })
    ])
        .then(([presence, feed]) => { setSessions((presence && presence.sessions) || []); setNotices(feed || []) })
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [api, project])
    useLiveReload(load, { always: true })

    if (error) return <ErrorBanner error={error} />
    if (sessions === null) return <Loading />

    return <div className="mpm-col mpm-gap-4">
        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name="users" /> Trabalhando agora ({sessions.length})</div>
            {sessions.length === 0
                ? <EmptyState icon="users" title="Ninguém trabalhando" hint="Nenhuma sessão de agente ativa neste momento." />
                : <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr>
                        <th>Sessão</th><th>Presença</th><th>Itens</th><th>Pacotes</th><th>Fazendo agora</th><th>Último sinal</th>
                    </tr></thead>
                    <tbody>
                        {sessions.map((s) =>
                            <tr key={s.sessionId}>
                                <td>
                                    <div className="mpm-mono">{s.model || s.provider}</div>
                                    <div className="mpm-muted" style={{ fontSize: "11px" }}>{s.sessionName || s.objective || ""}</div>
                                </td>
                                <td><span className={`mpm-chip ${PRESENCE_CHIP[s.presence] || "mpm-chip--neutral"}`}>
                                    {PRESENCE_LABEL[s.presence] || s.presence}</span></td>
                                <td className="mpm-mono">{s.claimedItems.map((i) => i.key).join(", ") || <span className="mpm-muted">—</span>}</td>
                                {/* O pacote é onde dois agentes colidem de verdade: itens
                                    diferentes, mesmo arquivo. */}
                                <td className="mpm-muted" style={{ fontSize: "11px" }}>{s.claimedPackages.join(", ") || "—"}</td>
                                <td style={{ fontSize: "12px" }}>{s.lastProgress ? s.lastProgress.note : (s.currentFocus || <span className="mpm-muted">sem relato</span>)}</td>
                                <td className="mpm-muted" style={{ fontSize: "11px" }}>{s.lastActivityAt ? formatDateTime(s.lastActivityAt) : "—"}</td>
                            </tr>)}
                    </tbody></table></div>}
        </div>

        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name="bullhorn" /> Avisos entre agentes</div>
            {notices.length === 0
                ? <div className="mpm-muted" style={{ fontSize: "12px" }}>nenhum aviso ainda</div>
                : notices.map((n) =>
                    <div key={n.id} className="mpm-row mpm-wrap" style={{ padding: "5px 0", borderBottom: "1px solid var(--mp-line-faint)", gap: "8px" }}>
                        <Icon name={(NOTICE_ICON[n.kind] || "info circle") as any} />
                        <span style={{ flex: 1, fontSize: "12px" }}>{n.body}</span>
                        <span className="mpm-muted" style={{ fontSize: "11px" }}>{formatDateTime(n.createdAt)}</span>
                    </div>)}
        </div>
    </div>
}

export default AgentPresencePanel
