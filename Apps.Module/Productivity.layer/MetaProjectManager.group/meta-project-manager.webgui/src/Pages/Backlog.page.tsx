import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useItemFilters from "../Hooks/useItemFilters"
import { Project, WorkItem, User, Milestone, Sprint, HORIZONS } from "../api/types"
import AppShell from "../Components/AppShell"
import WorkItemInspector from "../Components/WorkItemInspector"
import ItemFilterBar from "../Components/ItemFilterBar"
import {
    TypeBadge, PriorityBadge, ValueBadge, EffortBadge, AreaBadge, HorizonChip,
    StatusChip, Avatar, ItemMeta, Loading, EmptyState, ErrorBanner
} from "../Components/Primitives"
import { horizonLabel } from "../Utils/format"

// BacklogPage (Fase 2): backlog priorizado por VALOR (sort=value), com filtros,
// badges (tipo/valor/esforço/área/horizonte) e atribuição inline de horizonte,
// milestone e sprint.
const BacklogPage = () => {
    const api = useApi()
    const { projectId } = useParams<{ projectId: string }>()
    const { filters, setFilter, reset, activeCount } = useItemFilters("backlog", projectId)

    const [project, setProject] = useState<Project | null>(null)
    const [items, setItems] = useState<WorkItem[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [sprints, setSprints] = useState<Sprint[]>([])
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
        return api.items.list(projectId, { ...filters, sort: "value" })
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
    }

    useEffect(() => {
        if (!projectId) return
        Promise.all([api.projects.get(projectId), api.users.list({}), api.planning.listMilestones(projectId), api.planning.listSprints(projectId)])
            .then(([p, u, ms, sp]) => { setProject(p); setUsers(u || []); setMilestones(ms || []); setSprints(sp || []) })
            .catch((e) => setError(e.message))
    }, [projectId, api])

    // recarrega quando os filtros mudam
    useEffect(() => {
        if (!projectId) return
        setLoading(true)
        loadItems().then(() => setLoading(false))
    }, [projectId, JSON.stringify(filters)])

    const quickCreate = async () => {
        if (!draft.trim() || !projectId) return
        setBusy(true); setError(null)
        try { await api.items.create(projectId, { title: draft.trim(), status: "backlog" }); setDraft(""); await loadItems() }
        catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const patchItem = async (id: string, patch: () => Promise<any>) => {
        setError(null)
        try { await patch(); await loadItems() } catch (e: any) { setError(e.message) }
    }

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={loadItems} />
        : undefined

    return <AppShell active="backlog" activeProjectId={projectId}
        activeProjectName={project ? project.name : undefined} inspector={inspector}>
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Backlog</h1>
                <div className="mpm-page-subtitle">{project ? project.name : ""} · priorizado por valor</div>
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

        <ItemFilterBar filters={filters} setFilter={setFilter} reset={reset} activeCount={activeCount}
            users={users} milestones={milestones} sprints={sprints} />

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : items.length === 0
                ? <EmptyState icon="clipboard list" title="Backlog vazio" hint="Adicione itens acima ou ajuste os filtros." />
                : <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr>
                        <th>Item</th>
                        <th style={{ width: 80 }}>Valor</th>
                        <th style={{ width: 60 }}>Esf.</th>
                        <th style={{ width: 120 }}>Horizonte</th>
                        <th style={{ width: 140 }}>Milestone</th>
                        <th style={{ width: 140 }}>Sprint</th>
                        <th style={{ width: 60 }}>Resp.</th>
                        <th style={{ width: 100 }}>Info</th>
                    </tr></thead>
                    <tbody>
                        {items.map((it) => {
                            const assignee = it.assigneeUserId ? usersById[it.assigneeUserId] : undefined
                            return <tr key={it.id} className="mpm-table__row--clickable">
                                <td onClick={() => setSelected(it.id)}>
                                    <span className="mpm-row mpm-wrap">
                                        <TypeBadge type={it.type} />
                                        <PriorityBadge priority={it.priority} />
                                        <AreaBadge area={it.area} />
                                        <span className="mpm-mono mpm-muted">{it.key}</span>
                                        <span style={{ fontWeight: 600 }}>{it.title}</span>
                                        <StatusChip status={it.statusKey} />
                                    </span>
                                </td>
                                <td><ValueBadge value={it.value} /></td>
                                <td><EffortBadge effort={it.effort} /></td>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <select className="mpm-inline-select" value={it.horizon || ""}
                                        onChange={(e) => patchItem(it.id, () => api.items.update(it.id, { horizon: e.target.value }))}>
                                        <option value="">—</option>
                                        {HORIZONS.map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
                                    </select>
                                </td>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <select className="mpm-inline-select" value={it.milestoneId || ""}
                                        onChange={(e) => patchItem(it.id, () => api.planning.assignItemPlanning(it.id, { milestone: e.target.value || "none" }))}>
                                        <option value="">—</option>
                                        {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </td>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <select className="mpm-inline-select" value={it.sprintId || ""}
                                        onChange={(e) => patchItem(it.id, () => api.planning.assignItemPlanning(it.id, { sprint: e.target.value || "none" }))}>
                                        <option value="">—</option>
                                        {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </td>
                                <td onClick={() => setSelected(it.id)}><Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} /></td>
                                <td onClick={() => setSelected(it.id)}><ItemMeta item={it} /></td>
                            </tr>
                        })}
                    </tbody></table></div>}
    </AppShell>
}

export default BacklogPage
