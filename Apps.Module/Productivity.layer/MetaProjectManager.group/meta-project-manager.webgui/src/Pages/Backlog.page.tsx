import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Project, WorkItem, User } from "../api/types"
import AppShell from "../Components/AppShell"
import WorkItemInspector from "../Components/WorkItemInspector"
import { TypeBadge, PriorityBadge, StatusChip, Avatar, ItemMeta, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"

const PRIORITY_ORDER: { [k: string]: number } = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 }

// BacklogPage (spec §11): lista priorizada + criação rápida.
const BacklogPage = () => {
    const api = useApi()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [items, setItems] = useState<WorkItem[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [draft, setDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const usersById = useMemo(() => {
        const m: { [id: string]: User } = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const loadItems = () => {
        if (!projectId) return Promise.resolve()
        return api.items.list(projectId, {})
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
    }

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        Promise.all([api.projects.get(projectId), api.users.list({})])
            .then(([p, u]) => { setProject(p); setUsers(u || []) })
            .catch((e) => setError(e.message))
        loadItems().then(() => setLoading(false))
    }, [projectId, api])

    const sorted = useMemo(() =>
        items.slice().sort((a, b) => {
            const pa = PRIORITY_ORDER[a.priority] ?? 4
            const pb = PRIORITY_ORDER[b.priority] ?? 4
            if (pa !== pb) return pa - pb
            return (a.order || 0) - (b.order || 0)
        }), [items])

    const quickCreate = async () => {
        if (!draft.trim() || !projectId) return
        setBusy(true); setError(null)
        try { await api.items.create(projectId, { title: draft.trim(), status: "backlog" }); setDraft(""); await loadItems() }
        catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={loadItems} />
        : undefined

    return <AppShell active="board" activeProjectId={projectId}
        activeProjectName={project ? project.name : undefined} inspector={inspector}>
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Backlog</h1>
                <div className="mpm-page-subtitle">{project ? project.name : ""} · priorizado</div>
            </div>
        </div>

        <div className="mpm-card">
            <div className="mpm-row">
                <input className="mpm-input" placeholder="Criação rápida: título do item + Enter"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") quickCreate() }} />
                <button className="mpm-btn mpm-btn--primary" disabled={busy || !draft.trim()} onClick={quickCreate}>
                    <Icon name="plus" /> Adicionar
                </button>
            </div>
        </div>

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : sorted.length === 0
                ? <EmptyState icon="inbox" title="Backlog vazio" hint="Adicione itens acima." />
                : <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr><th style={{ width: 90 }}>Prio.</th><th>Item</th><th style={{ width: 140 }}>Status</th><th style={{ width: 60 }}>Resp.</th><th style={{ width: 120 }}>Info</th></tr></thead>
                    <tbody>
                        {sorted.map((it) => {
                            const assignee = it.assigneeUserId ? usersById[it.assigneeUserId] : undefined
                            return <tr key={it.id} className="mpm-table__row--clickable" onClick={() => setSelected(it.id)}>
                                <td><PriorityBadge priority={it.priority} /></td>
                                <td><span className="mpm-row"><TypeBadge type={it.type} /><span className="mpm-mono mpm-muted">{it.key}</span><span>{it.title}</span></span></td>
                                <td><StatusChip status={it.statusKey} /></td>
                                <td><Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} /></td>
                                <td><ItemMeta item={it} /></td>
                            </tr>
                        })}
                    </tbody></table></div>}
    </AppShell>
}

export default BacklogPage
