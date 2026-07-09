import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useEvents from "../Hooks/useEvents"
import { ActivityEntry, ActivityFilters, ActivityNote, Project, User, PlatformEvent } from "../api/types"
import AppShell from "../Components/AppShell"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { formatDateTime, humanizeAction } from "../Utils/format"

type ViewMode = "timeline" | "table"

const ACTOR_TYPES = ["", "human", "agent", "system", "desktop"]
const SOURCES = ["", "gui", "cli", "api", "agent", "mcp", "desktop"]
const PROVIDERS = ["", "claude", "codex", "chatgpt", "other"]

// Ícone por tipo de ação (leitura rápida da timeline).
const actionIcon = (action: string): any => {
    if (action.indexOf("delete") >= 0) return "trash"
    if (action.indexOf("approve") >= 0) return "check circle"
    if (action.indexOf("reject") >= 0) return "ban"
    if (action.indexOf("request") >= 0) return "shield"
    if (action.indexOf("create") >= 0) return "plus circle"
    if (action.indexOf("status") >= 0) return "exchange"
    if (action.indexOf("archive") >= 0) return "archive"
    return "pencil"
}

const actorLabel = (e: ActivityEntry, usersById: Record<string, User>): string => {
    const u = e.actorUserId ? usersById[e.actorUserId] : undefined
    if (u) return u.displayName
    if (e.actorType === "agent") return e.provider ? `Agente (${e.provider})` : "Agente"
    if (e.actorType === "desktop") return "Usuário Desktop"
    return e.actorType || "Sistema"
}

// "Claude atualizou status de work-item para done"
const humanTitle = (e: ActivityEntry, usersById: Record<string, User>): string => {
    const who = actorLabel(e, usersById)
    const what = (e.metadata && (e.metadata.key || e.metadata.name || e.metadata.title)) || e.entityType
    return `${who} · ${humanizeAction(e.action)} ${what}`
}

// Diff antes → depois, campo a campo.
const DiffView = ({ entry }: { entry: ActivityEntry }) => {
    const before = entry.before || {}
    const after = entry.after || {}
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    if (keys.length === 0) {
        if (!entry.metadata) return null
        return <pre className="mpm-audit__json">{JSON.stringify(entry.metadata, null, 2)}</pre>
    }
    return <table className="mpm-audit__diff">
        <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
        <tbody>
            {keys.map((k) =>
                <tr key={k}>
                    <td className="mpm-mono">{k}</td>
                    <td className="mpm-audit__before">{JSON.stringify(before[k]) ?? "—"}</td>
                    <td className="mpm-audit__after">{JSON.stringify(after[k]) ?? "—"}</td>
                </tr>)}
        </tbody>
    </table>
}

// Agrupa eventos por dia (YYYY-MM-DD) preservando a ordem (mais recente primeiro).
const groupByDay = (events: ActivityEntry[]) => {
    const groups: { day: string; events: ActivityEntry[] }[] = []
    for (const e of events) {
        const day = (e.createdAt || "").slice(0, 10)
        const last = groups[groups.length - 1]
        if (last && last.day === day) last.events.push(e)
        else groups.push({ day, events: [e] })
    }
    return groups
}

// Tela de Auditoria/Atividades (spec §9): o que agentes e humanos fizeram,
// com filtros por projeto, ator, modelo, fonte, ação e período.
const AuditPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const location = useLocation()

    const initialProject = new URLSearchParams(location.search).get("project") || ""

    const [filters, setFilters] = useState<ActivityFilters>({ project: initialProject, limit: "100" })
    const [events, setEvents] = useState<ActivityEntry[] | null>(null)
    const [notes, setNotes] = useState<ActivityNote[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [view, setView] = useState<ViewMode>("timeline")
    const [error, setError] = useState<string | null>(null)
    const [noteText, setNoteText] = useState("")

    const usersById = useMemo(() => {
        const m: Record<string, User> = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const setFilter = (key: keyof ActivityFilters, value: string) =>
        setFilters((f) => ({ ...f, [key]: value || undefined }))

    const reset = () => setFilters({ limit: "100" })

    const load = useCallback(() => {
        setError(null)
        const query: ActivityFilters = { ...filters }
        Object.keys(query).forEach((k) => { if (!(query as any)[k]) delete (query as any)[k] })
        return api.activity.listAudit(query)
            .then((l) => setEvents(l || []))
            .catch((e) => { setError(e.message); setEvents([]) })
    }, [api, filters])

    const loadNotes = useCallback(() => {
        if (!filters.project) { setNotes([]); return Promise.resolve() }
        return api.activity.listNotes({ project: filters.project, limit: "50" })
            .then((l) => setNotes(l || []))
            .catch(() => setNotes([]))
    }, [api, filters.project])

    useEffect(() => { load(); loadNotes() }, [load, loadNotes])

    useEffect(() => {
        api.projects.list({}).then((l) => setProjects(l || [])).catch(() => {})
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
    }, [api])

    // Reatividade: novo evento de auditoria/atividade recarrega a lista.
    const onEvents = useCallback((incoming: PlatformEvent[]) => {
        if (incoming.some((e) => e.type === "audit.created" || e.type === "activity.created")) { load(); loadNotes() }
    }, [load, loadNotes])
    useEvents(onEvents, 5000)

    const addNote = async () => {
        if (!noteText.trim() || !filters.project) return
        try {
            await api.activity.addNote({ project: filters.project, text: noteText.trim() })
            setNoteText(""); await loadNotes()
        } catch (e: any) { setError(e.message) }
    }

    const exportJson = () => {
        const blob = new Blob([JSON.stringify(events || [], null, 2)], { type: "application/json" })
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = "auditoria.json"
        a.click()
    }

    const groups = useMemo(() => groupByDay(events || []), [events])

    return <AppShell active="audit">
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Auditoria & Atividades</h1>
                <div className="mpm-page-subtitle">Quem fez o quê, quando, com qual modelo e a partir de qual fonte.</div>
            </div>
            <div className="mpm-page-head__actions">
                <div className="mpm-seg">
                    <button className={`mpm-seg__btn ${view === "timeline" ? "is-active" : ""}`}
                        title="Linha do tempo agrupada por dia" onClick={() => setView("timeline")}>
                        <Icon name="history" /> Timeline
                    </button>
                    <button className={`mpm-seg__btn ${view === "table" ? "is-active" : ""}`}
                        title="Tabela técnica, para filtrar e exportar" onClick={() => setView("table")}>
                        <Icon name="table" /> Tabela
                    </button>
                </div>
                <button className="mpm-btn" title="Exportar os eventos filtrados (.json)" onClick={exportJson}>
                    <Icon name="download" /> Exportar
                </button>
            </div>
        </div>

        {/* Filtros */}
        <div className="mpm-panel mpm-audit__filters">
            <div className="mpm-audit__filter-row">
                <label className="mpm-field" title="Restringe a um projeto; vazio = todos os projetos">
                    <span className="mpm-field__label">Projeto</span>
                    <select className="mpm-select" value={filters.project || ""} onChange={(e) => setFilter("project", e.target.value)}>
                        <option value="">Todos os projetos</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </label>
                <label className="mpm-field" title="Humano, agente de IA, sistema ou usuario-desktop">
                    <span className="mpm-field__label">Tipo de ator</span>
                    <select className="mpm-select" value={filters.actorType || ""} onChange={(e) => setFilter("actorType", e.target.value)}>
                        {ACTOR_TYPES.map((t) => <option key={t} value={t}>{t || "Todos"}</option>)}
                    </select>
                </label>
                <label className="mpm-field" title="De onde a ação partiu">
                    <span className="mpm-field__label">Fonte</span>
                    <select className="mpm-select" value={filters.source || ""} onChange={(e) => setFilter("source", e.target.value)}>
                        {SOURCES.map((t) => <option key={t} value={t}>{t || "Todas"}</option>)}
                    </select>
                </label>
                <label className="mpm-field" title="Provider do agente de IA">
                    <span className="mpm-field__label">Provider</span>
                    <select className="mpm-select" value={filters.provider || ""} onChange={(e) => setFilter("provider", e.target.value)}>
                        {PROVIDERS.map((t) => <option key={t} value={t}>{t || "Todos"}</option>)}
                    </select>
                </label>
            </div>
            <div className="mpm-audit__filter-row">
                <label className="mpm-field" title="Nome do modelo (ex.: claude-opus-4)">
                    <span className="mpm-field__label">Modelo</span>
                    <input className="mpm-input" value={filters.model || ""} placeholder="claude-opus-4"
                        onChange={(e) => setFilter("model", e.target.value)} />
                </label>
                <label className="mpm-field" title="Ex.: create, update, set-status, approve, delete">
                    <span className="mpm-field__label">Ação</span>
                    <input className="mpm-input" value={filters.action || ""} placeholder="set-status"
                        onChange={(e) => setFilter("action", e.target.value)} />
                </label>
                <label className="mpm-field" title="Data/hora inicial">
                    <span className="mpm-field__label">De</span>
                    <input className="mpm-input" type="date" value={filters.from || ""} onChange={(e) => setFilter("from", e.target.value)} />
                </label>
                <label className="mpm-field" title="Data/hora final">
                    <span className="mpm-field__label">Até</span>
                    <input className="mpm-input" type="date" value={filters.to || ""} onChange={(e) => setFilter("to", e.target.value)} />
                </label>
                <button className="mpm-btn mpm-btn--ghost" style={{ alignSelf: "flex-end" }} onClick={reset}>
                    <Icon name="undo" /> Limpar
                </button>
            </div>
        </div>

        <ErrorBanner error={error} />

        {/* Anotações do escopo (usuario-desktop) */}
        {filters.project
            ? <div className="mpm-panel">
                <div className="mpm-panel__title">
                    <Icon name="sticky note" /> Anotações do projeto ({notes.length})
                </div>
                <div className="mpm-row" style={{ gap: "var(--mp-space-2)" }}>
                    <input className="mpm-input" style={{ flex: 1 }} value={noteText}
                        placeholder="Registrar uma anotação manual (atribuída ao usuario-desktop)…"
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addNote() }} />
                    <button className="mpm-btn mpm-btn--primary" disabled={!noteText.trim()} onClick={addNote}>
                        <Icon name="plus" /> Anotar
                    </button>
                </div>
                {notes.length > 0
                    ? <div className="mpm-col" style={{ marginTop: "var(--mp-space-3)" }}>
                        {notes.map((n) =>
                            <div key={n.id} className="mpm-audit__note">
                                <Icon name="sticky note outline" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div>{n.body}</div>
                                    <div className="mpm-mono mpm-muted" style={{ fontSize: "11px" }}>
                                        {n.scopeType} · {n.source} · {formatDateTime(n.createdAt)}
                                    </div>
                                </div>
                            </div>)}
                    </div>
                    : null}
            </div>
            : null}

        {events === null
            ? <Loading />
            : events.length === 0
                ? <EmptyState icon="history" title="Nenhum evento"
                    hint="Nenhuma atividade corresponde aos filtros — ajuste o período ou limpe os filtros."
                    action={<button className="mpm-btn" onClick={reset}><Icon name="undo" /> Limpar filtros</button>} />
                : view === "timeline"
                    ? <div className="mpm-col mpm-gap-4">
                        {groups.map((g) =>
                            <div key={g.day} className="mpm-panel">
                                <div className="mpm-panel__title"><Icon name="calendar outline" /> {g.day}</div>
                                <div className="mpm-timeline">
                                    {g.events.map((e) =>
                                        <div key={e.id} className="mpm-timeline__item mpm-audit__event">
                                            <span className="mpm-avatar"><Icon name={actionIcon(e.action)} size="small" style={{ margin: 0 }} /></span>
                                            <div className="mpm-timeline__body" style={{ minWidth: 0 }}>
                                                <div className="mpm-audit__title">
                                                    <strong>{humanTitle(e, usersById)}</strong>
                                                    {e.actorType === "agent"
                                                        ? <span className="mpm-chip mpm-chip--info">{e.model || e.provider}</span>
                                                        : null}
                                                    {e.actorType === "desktop"
                                                        ? <span className="mpm-chip mpm-chip--neutral">desktop</span>
                                                        : null}
                                                </div>
                                                <div className="mpm-timeline__meta mpm-mono">
                                                    <span>{e.source}</span>
                                                    <span>{e.entityType}</span>
                                                    {e.traceId ? <span title="trace/sessão">{e.traceId}</span> : null}
                                                    <span>{formatDateTime(e.createdAt)}</span>
                                                    {e.projectId
                                                        ? <a onClick={() => navigate(`/projects/${e.projectId}`)} style={{ cursor: "pointer" }}>abrir projeto</a>
                                                        : null}
                                                </div>
                                                {(e.before || e.after || e.metadata)
                                                    ? <>
                                                        <button className="mpm-btn mpm-btn--ghost mpm-btn--sm"
                                                            onClick={() => setExpanded((s) => ({ ...s, [e.id]: !s[e.id] }))}>
                                                            <Icon name={expanded[e.id] ? "caret down" : "caret right"} /> diff
                                                        </button>
                                                        {expanded[e.id] ? <DiffView entry={e} /> : null}
                                                    </>
                                                    : null}
                                            </div>
                                        </div>)}
                                </div>
                            </div>)}
                    </div>
                    : <div className="mpm-panel mpm-scroll-x">
                        <table className="mpm-table">
                            <thead><tr>
                                <th>Quando</th><th>Ator</th><th>Tipo</th><th>Ação</th>
                                <th>Entidade</th><th>Fonte</th><th>Modelo</th><th>Sessão</th>
                            </tr></thead>
                            <tbody>
                                {events.map((e) =>
                                    <tr key={e.id}>
                                        <td className="mpm-mono">{formatDateTime(e.createdAt)}</td>
                                        <td>{actorLabel(e, usersById)}</td>
                                        <td><span className="mpm-chip mpm-chip--neutral">{e.actorType || "—"}</span></td>
                                        <td className="mpm-mono">{e.action}</td>
                                        <td className="mpm-mono">{e.entityType}</td>
                                        <td className="mpm-mono">{e.source}</td>
                                        <td className="mpm-mono">{e.model || "—"}</td>
                                        <td className="mpm-mono">{e.traceId || "—"}</td>
                                    </tr>)}
                            </tbody>
                        </table>
                    </div>}
    </AppShell>
}

export default AuditPage
