import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Project, WorkItem } from "../api/types"
import { Metric, StatusChip, Loading, EmptyState, ErrorBanner } from "./Primitives"

interface GroupRow { userId?: string; label?: string; count: number }

// ReportDashboard (spec §11.1): project-status, blocked, overdue, by-assignee,
// by-agent. Os relatórios são por projeto — exige um projeto selecionado.
const ReportDashboard = () => {
    const api = useApi()
    const [projects, setProjects] = useState<Project[]>([])
    const [project, setProject] = useState<string>("")
    const [status, setStatus] = useState<any>(null)
    const [blocked, setBlocked] = useState<WorkItem[]>([])
    const [overdue, setOverdue] = useState<WorkItem[]>([])
    const [byAssignee, setByAssignee] = useState<GroupRow[]>([])
    const [byAgent, setByAgent] = useState<GroupRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        api.projects.list({}).then((l) => {
            setProjects(l || [])
            if (l && l.length > 0) setProject(l[0].id)
        }).catch((e) => setError(e.message))
    }, [api])

    useEffect(() => {
        if (!project) return
        setLoading(true); setError(null)
        Promise.all([
            api.reports.projectStatus(project),
            api.reports.blocked(project),
            api.reports.overdue(project),
            api.reports.byAssignee(project),
            api.reports.byAgent(project)
        ]).then(([st, bl, ov, ba, bg]) => {
            setStatus(st); setBlocked(bl || []); setOverdue(ov || []); setByAssignee(ba || []); setByAgent(bg || [])
        }).catch((e) => setError(e.message)).then(() => setLoading(false))
    }, [project])

    const maxCount = (rows: GroupRow[]) => rows.reduce((m, r) => Math.max(m, r.count), 1)

    const groupPanel = (title: string, icon: any, rows: GroupRow[]) =>
        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name={icon} /> {title}</div>
            {rows.length === 0
                ? <div className="mpm-muted" style={{ fontSize: "12px" }}>sem dados</div>
                : <div className="mpm-col">
                    {rows.map((r, i) =>
                        <div key={i} className="mpm-row">
                            <span style={{ width: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label || r.userId || "unassigned"}</span>
                            <div className="mpm-progress" style={{ flex: 1 }}>
                                <div className="mpm-progress__fill" style={{ width: `${(r.count / maxCount(rows)) * 100}%`, background: "var(--mp-accent-blue)" }} />
                            </div>
                            <span className="mpm-mono">{r.count}</span>
                        </div>)}
                </div>}
        </div>

    const itemsPanel = (title: string, icon: any, items: WorkItem[]) =>
        <div className="mpm-panel">
            <div className="mpm-panel__title"><Icon name={icon} /> {title} ({items.length})</div>
            {items.length === 0
                ? <div className="mpm-muted" style={{ fontSize: "12px" }}>nenhum item</div>
                : <div className="mpm-scroll-x"><table className="mpm-table">
                    <thead><tr><th>Chave</th><th>Título</th><th>Status</th></tr></thead>
                    <tbody>
                        {items.map((it) =>
                            <tr key={it.id}>
                                <td className="mpm-mono mpm-muted">{it.key}</td>
                                <td>{it.title}</td>
                                <td><StatusChip status={it.statusKey} /></td>
                            </tr>)}
                    </tbody></table></div>}
        </div>

    return <div className="mpm-col mpm-gap-4">
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Relatórios</h1>
                <div className="mpm-page-subtitle">visão analítica do projeto</div>
            </div>
            <div className="mpm-page-head__actions">
                <select className="mpm-select" style={{ width: 240 }} value={project} onChange={(e) => setProject(e.target.value)}>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
        </div>
        <ErrorBanner error={error} />

        {projects.length === 0
            ? <EmptyState icon="chart bar" title="Nenhum projeto" hint="Crie um projeto para ver relatórios." />
            : loading
                ? <Loading />
                : <div className="mpm-col mpm-gap-4">
                    {status
                        ? <div className="mpm-card">
                            <div className="mpm-metrics-row">
                                <Metric value={status.total ?? 0} label="Total" />
                                <Metric value={status.done ?? 0} label="Concluídos" />
                                <Metric value={blocked.length} label="Bloqueados" />
                                <Metric value={overdue.length} label="Atrasados" />
                            </div>
                            {status.byStatus
                                ? <div className="mpm-row mpm-wrap" style={{ marginTop: "var(--mp-space-4)" }}>
                                    {Object.keys(status.byStatus).map((k) =>
                                        <span key={k} className="mpm-row"><StatusChip status={k} /><span className="mpm-mono">{status.byStatus[k]}</span></span>)}
                                </div>
                                : null}
                        </div>
                        : null}
                    <div className="mpm-grid-cards">
                        {groupPanel("Por responsável", "user", byAssignee)}
                        {groupPanel("Por agente", "microchip", byAgent)}
                    </div>
                    {itemsPanel("Bloqueados", "ban", blocked)}
                    {itemsPanel("Atrasados", "clock", overdue)}
                </div>}
    </div>
}

export default ReportDashboard
