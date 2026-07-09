import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Agent, AgentSession, CreationRequest } from "../api/types"
import { Loading, EmptyState, ErrorBanner } from "./Primitives"
import { formatDateTime } from "../Utils/format"

const STATUS_CHIP: Record<string, string> = {
    pending: "mpm-chip--warning",
    approved: "mpm-chip--success",
    rejected: "mpm-chip--danger",
    failed: "mpm-chip--danger",
    expired: "mpm-chip--neutral",
    cancelled: "mpm-chip--neutral"
}
const STATUSES = ["all", "pending", "approved", "rejected", "failed"]

const actionLabel = (r: CreationRequest) =>
    `${(r.actionName || "create") === "delete" ? "Remover" : "Criar"} ${r.type}`

// Histórico do que cada agente pediu para aprovar — filtrável por AGENTE e por SESSÃO.
// Complementa a fila de pendentes: aqui entram aprovados, rejeitados e falhos.
const AgentRequestHistory = () => {
    const api = useApi()
    const [requests, setRequests] = useState<CreationRequest[] | null>(null)
    const [agents, setAgents] = useState<Agent[]>([])
    const [sessions, setSessions] = useState<AgentSession[]>([])
    const [agent, setAgent] = useState("")
    const [session, setSession] = useState("")
    const [status, setStatus] = useState("all")
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(() => {
        setError(null)
        const query: any = { status, limit: "200" }
        if (session) query.session = session
        else if (agent) query.agent = agent
        return api.agents.listCreationRequests(query)
            .then((l) => setRequests(l || []))
            .catch((e) => { setError(e.message); setRequests([]) })
    }, [api, agent, session, status])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        api.agents.list().then((l) => setAgents(l || [])).catch(() => {})
    }, [api])

    // As sessões listadas seguem o agente escolhido (o filtro fica coerente).
    useEffect(() => {
        setSession("")
        api.agents.listSessions(agent ? { agent } : {})
            .then((l) => setSessions(l || []))
            .catch(() => setSessions([]))
    }, [api, agent])

    return <div className="mpm-panel">
        <div className="mpm-panel__title">
            <Icon name="history" /> Histórico de pedidos
            <span style={{ flex: 1 }} />
            <span className="mpm-muted mpm-mono" style={{ fontSize: 12 }}>
                {requests ? `${requests.length}` : ""}
            </span>
        </div>

        <div className="mpm-audit__bar" style={{ marginBottom: "var(--mp-space-3)" }}>
            <Icon name="filter" className="mpm-muted" />
            <select className="mpm-inline-select" value={agent} title="Filtrar por agente"
                onChange={(e) => setAgent(e.target.value)}>
                <option value="">Todos os agentes</option>
                {agents.map((a) =>
                    <option key={a.userId} value={a.userId}>
                        {a.displayName || a.handle || a.provider}
                    </option>)}
            </select>
            <select className="mpm-inline-select" value={session} title="Filtrar por sessão do agente"
                onChange={(e) => setSession(e.target.value)}>
                <option value="">Todas as sessões</option>
                {sessions.map((s) =>
                    <option key={s.id} value={s.id}>
                        {(s.modelName || s.provider)} · {s.id.slice(0, 8)}
                    </option>)}
            </select>
            <select className="mpm-inline-select" value={status} title="Situação do pedido"
                onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "Todos os status" : s}</option>)}
            </select>
            {(agent || session || status !== "all")
                ? <button className="mpm-btn mpm-btn--sm mpm-btn--ghost"
                    onClick={() => { setAgent(""); setSession(""); setStatus("all") }}>
                    <Icon name="undo" /> Limpar
                </button>
                : null}
        </div>

        <ErrorBanner error={error} />

        {requests === null
            ? <Loading />
            : requests.length === 0
                ? <EmptyState icon="history" title="Sem pedidos"
                    hint="Nenhum pedido de aprovação corresponde a estes filtros." />
                : <div className="mpm-scroll-x">
                    <table className="mpm-table">
                        <thead><tr>
                            <th>Quando</th><th>Ação</th><th>Alvo</th><th>Agente</th>
                            <th>Modelo</th><th>Sessão</th><th>Status</th><th style={{ width: 40 }} />
                        </tr></thead>
                        <tbody>
                            {requests.map((r) => {
                                const who = r.who || {}
                                const target = r.impact?.targetLabel
                                    || (r.payload && (r.payload.name || r.payload.title))
                                    || r.targetId || "—"
                                return <React.Fragment key={r.id}>
                                    <tr>
                                        <td className="mpm-mono">{formatDateTime(r.requestedAt)}</td>
                                        <td>
                                            <span className={`mpm-badge ${(r.actionName || "create") === "delete" ? "mpm-badge--type-bug" : "mpm-badge--type-epic"}`}>
                                                {actionLabel(r)}
                                            </span>
                                        </td>
                                        <td title={target} style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target}</td>
                                        <td>{who.provider || "—"}</td>
                                        <td className="mpm-mono">{who.model || "—"}</td>
                                        <td className="mpm-mono" title={r.session?.traceId || ""}>{who.traceId || "—"}</td>
                                        <td>
                                            <span className={`mpm-chip mpm-chip--cap ${STATUS_CHIP[r.status] || "mpm-chip--neutral"}`}>{r.status}</span>
                                        </td>
                                        <td>
                                            <Icon link name={expanded[r.id] ? "caret down" : "caret right"}
                                                title="Detalhes do pedido"
                                                onClick={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))} />
                                        </td>
                                    </tr>
                                    {expanded[r.id]
                                        ? <tr>
                                            <td colSpan={8}>
                                                <div className="mpm-approval__facts" style={{ marginBottom: 8 }}>
                                                    <span><b>Risco</b> {r.risk || "normal"}</span>
                                                    {r.rejectionReason ? <span><b>Motivo</b> {r.rejectionReason}</span> : null}
                                                    {r.session?.host ? <span><b>Host</b> {r.session.host}</span> : null}
                                                    {r.session?.workingDirectory ? <span><b>Dir</b> {r.session.workingDirectory}</span> : null}
                                                </div>
                                                <pre className="mpm-audit__json">{JSON.stringify(r.payload || {}, null, 2)}</pre>
                                            </td>
                                        </tr>
                                        : null}
                                </React.Fragment>
                            })}
                        </tbody>
                    </table>
                </div>}
    </div>
}

export default AgentRequestHistory
