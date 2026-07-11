import * as React from "react"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, Milestone, Sprint, WorkItem, User, HorizonBoard as HorizonBoardData } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import MilestoneModal from "../Components/MilestoneModal"
import SprintModal from "../Components/SprintModal"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import HorizonBoard from "../Components/HorizonBoard"
import WorkItemInspector from "../Components/WorkItemInspector"
import { Progress, StatusChip, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { formatDate } from "../Utils/format"

type RoadmapMode = "date" | "horizon"

const EMPTY_HORIZON: HorizonBoardData = { inbox: [], now: [], next: [], later: [], maybe: [], archived: [], unassigned: [] }

// Roadmap (frente A): timeline de milestones por data-alvo (progresso
// doneItems/totalItems + itens) e gestão de milestones/sprints.
const RoadmapPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [sprints, setSprints] = useState<Sprint[]>([])
    const [itemsByMilestone, setItemsByMilestone] = useState<{ [id: string]: WorkItem[] }>({})
    const [expanded, setExpanded] = useState<{ [id: string]: boolean }>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<RoadmapMode>("date")
    const [horizonData, setHorizonData] = useState<HorizonBoardData>(EMPTY_HORIZON)
    const [users, setUsers] = useState<User[]>([])
    const [selected, setSelected] = useState<string | null>(null)

    const [msModal, setMsModal] = useState<{ open: boolean; milestone?: Milestone }>({ open: false })
    const [spModal, setSpModal] = useState<{ open: boolean; sprint?: Sprint }>({ open: false })
    const [pendingDelete, setPendingDelete] = useState<{ kind: "milestone" | "sprint"; id: string; name: string } | null>(null)
    const [deleting, setDeleting] = useState(false)

    const usersById: { [id: string]: User } = {}
    users.forEach((u) => { usersById[u.id] = u })

    const load = () => {
        if (!projectId) return Promise.resolve()
        return Promise.all([api.planning.roadmap(projectId), api.planning.listSprints(projectId)])
            .then(([road, sp]) => { setMilestones(road || []); setSprints(sp || []) })
            .catch((e) => setError(e.message))
    }

    const loadHorizon = () => {
        if (!projectId) return Promise.resolve()
        return api.planning.roadmapByHorizon(projectId)
            .then((d) => setHorizonData({ ...EMPTY_HORIZON, ...(d || {}) }))
            .catch((e) => setError(e.message))
    }

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.users.list({}).then((u) => setUsers(u || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api])

    useEffect(() => { if (mode === "horizon") loadHorizon() }, [mode, projectId])
    // Entregas/sprints/horizontes mexidos por agentes se atualizam sozinhos.
    useLiveReload(() => { load(); if (mode === "horizon") loadHorizon() }, { projectId })

    const moveHorizon = async (itemId: string, horizon: string) => {
        setError(null)
        try { await api.items.update(itemId, { horizon }); await loadHorizon() }
        catch (e: any) { setError(e.message); loadHorizon() }
    }

    const toggleItems = (m: Milestone) => {
        const open = !expanded[m.id]
        setExpanded((s) => ({ ...s, [m.id]: open }))
        if (open && !itemsByMilestone[m.id] && projectId)
            api.items.list(projectId, { milestone: m.id })
                .then((l) => setItemsByMilestone((s) => ({ ...s, [m.id]: l || [] })))
                .catch(() => {})
    }

    const doDelete = async () => {
        if (!pendingDelete) return
        setDeleting(true); setError(null)
        try {
            if (pendingDelete.kind === "milestone") await api.planning.deleteMilestone(pendingDelete.id)
            else await api.planning.deleteSprint(pendingDelete.id)
            await load(); setPendingDelete(null)
        } catch (e: any) { setError(e.message) } finally { setDeleting(false) }
    }

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={loadHorizon} />
        : undefined

    // Referências a itens (CFGEC-26…) em qualquer texto desta tela abrem o inspector.
    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell active="roadmap" activeProjectId={projectId} activeProjectName={project ? project.name : undefined}
            inspector={inspector}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Planejamento" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Planejamento · entregas, sprints e horizontes"
            actions={<>
                <PageFeedbackButton scope="planning" projectId={projectId} label="Todo o planejamento" compact />
                <div className="mpm-seg">
                    <button className={`mpm-seg__btn ${mode === "date" ? "is-active" : ""}`} title="Linha do tempo das entregas, ordenada pela data-alvo" onClick={() => setMode("date")}><Icon name="calendar" /> Por data</button>
                    <button className={`mpm-seg__btn ${mode === "horizon" ? "is-active" : ""}`} title="Itens agrupados por horizonte (agora/próximo/depois/talvez)" onClick={() => setMode("horizon")}><Icon name="align left" /> Por horizonte</button>
                </div>
                <button className="mpm-btn" title="Sprint: janela de tempo fixa (iteração) com um objetivo" onClick={() => setSpModal({ open: true })}><Icon name="rocket" /> Novo Sprint</button>
                <button className="mpm-btn mpm-btn--primary" title="Entrega: um alvo com data (milestone, no jargão técnico)" onClick={() => setMsModal({ open: true })}><Icon name="flag" /> Nova Entrega</button>
            </>}
            onInspectorClose={() => setSelected(null)}>

        <ErrorBanner error={error} />

        {mode === "horizon"
            ? <HorizonBoard data={horizonData} usersById={usersById} onOpenItem={setSelected} onMoveHorizon={moveHorizon} />
            : loading
            ? <Loading />
            : <>
                <div className="mpm-panel">
                    <div className="mpm-panel__title"><Icon name="road" /> Entregas ({milestones.length})</div>
                    {milestones.length === 0
                        ? <EmptyState icon="flag outline" title="Sem entregas" hint="Crie uma entrega (um alvo com data) para montar o plano." />
                        : <div className="mpm-timeline">
                            {milestones.map((m) => {
                                const total = m.totalItems || 0
                                const done = m.doneItems || 0
                                const progress = typeof m.progress === "number" ? m.progress : (total ? Math.round((done / total) * 100) : 0)
                                return <div key={m.id} className="mpm-card mpm-col mpm-gap-4">
                                    <div className="mpm-row">
                                        <Icon name="flag" />
                                        <strong style={{ fontSize: "var(--mp-text-lg)", flex: 1 }}>{m.name}</strong>
                                        <StatusChip status={m.status} />
                                        {m.targetDate ? <span className="mpm-chip mpm-chip--info"><Icon name="calendar" /> {formatDate(m.targetDate)}</span> : null}
                                        <Icon name="pencil" link className="mpm-muted" onClick={() => setMsModal({ open: true, milestone: m })} />
                                        <Icon name="trash" link className="mpm-muted" onClick={() => setPendingDelete({ kind: "milestone", id: m.id, name: m.name })} />
                                    </div>
                                    <div className="mpm-row">
                                        <div style={{ flex: 1 }}><Progress value={progress} /></div>
                                        <span className="mpm-mono mpm-muted">{done}/{total} · {progress}%</span>
                                    </div>
                                    <div>
                                        <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={() => toggleItems(m)}>
                                            <Icon name={expanded[m.id] ? "caret down" : "caret right"} /> Itens
                                        </button>
                                        {expanded[m.id]
                                            ? <div className="mpm-col" style={{ marginTop: "var(--mp-space-2)" }}>
                                                {(itemsByMilestone[m.id] || []).length === 0
                                                    ? <span className="mpm-muted" style={{ fontSize: "12px" }}>nenhum item</span>
                                                    : (itemsByMilestone[m.id] || []).map((it) =>
                                                        <button key={it.id} className="mpm-subtask"
                                                            title={`Abrir ${it.key}`} onClick={() => setSelected(it.id)}>
                                                            <span className="mpm-mono mpm-muted">{it.key}</span>
                                                            <StatusChip status={it.statusKey} />
                                                            <span className="mpm-subtask__title">{it.title}</span>
                                                            <Icon name="chevron right" className="mpm-muted" />
                                                        </button>)}
                                            </div>
                                            : null}
                                    </div>
                                </div>
                            })}
                        </div>}
                </div>

                <div className="mpm-panel">
                    <div className="mpm-panel__title"><Icon name="rocket" /> Sprints ({sprints.length})</div>
                    {sprints.length === 0
                        ? <div className="mpm-muted" style={{ fontSize: "12px" }}>nenhum sprint</div>
                        : <div className="mpm-scroll-x"><table className="mpm-table">
                            <thead><tr><th>Sprint</th><th>Status</th><th>Período</th><th>Progresso</th><th style={{ width: 90 }} /></tr></thead>
                            <tbody>
                                {sprints.map((s) => {
                                    const progress = typeof s.progress === "number" ? s.progress : 0
                                    return <tr key={s.id}>
                                        <td><strong>{s.name}</strong>{s.goal ? <div className="mpm-muted" style={{ fontSize: "12px" }}>{s.goal}</div> : null}</td>
                                        <td><StatusChip status={s.status} /></td>
                                        <td className="mpm-muted">{formatDate(s.startDate)}{s.endDate ? ` → ${formatDate(s.endDate)}` : ""}</td>
                                        <td style={{ minWidth: 120 }}><Progress value={progress} /><span className="mpm-mono mpm-muted">{progress}%</span></td>
                                        <td><span className="mpm-row">
                                            <Icon name="pencil" link className="mpm-muted" onClick={() => setSpModal({ open: true, sprint: s })} />
                                            <Icon name="trash" link className="mpm-muted" onClick={() => setPendingDelete({ kind: "sprint", id: s.id, name: s.name })} />
                                        </span></td>
                                    </tr>
                                })}
                            </tbody></table></div>}
                </div>
            </>}

        {msModal.open && projectId
            ? <MilestoneModal projectId={projectId} milestone={msModal.milestone}
                onClose={() => setMsModal({ open: false })}
                onSaved={() => { setMsModal({ open: false }); load() }} />
            : null}
        {spModal.open && projectId
            ? <SprintModal projectId={projectId} sprint={spModal.sprint}
                onClose={() => setSpModal({ open: false })}
                onSaved={() => { setSpModal({ open: false }); load() }} />
            : null}

        {pendingDelete
            ? <ConfirmActionModal
                title={pendingDelete.kind === "milestone" ? "Excluir milestone" : "Excluir sprint"}
                danger
                message={<>Excluir {pendingDelete.kind === "milestone" ? "o milestone" : "o sprint"} <strong>{pendingDelete.name}</strong>?</>}
                consequences={[<>Os itens vinculados são preservados, apenas perdem este vínculo de planejamento.</>]}
                confirmLabel="Excluir"
                busy={deleting}
                error={error}
                onConfirm={doDelete}
                onCancel={() => setPendingDelete(null)} />
            : null}
        </AppShell>
    </ItemNavigatorProvider>
}

export default RoadmapPage
