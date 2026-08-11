import * as React from "react"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "@i-components"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { useReadOnly } from "../Hooks/useReadOnly"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, Milestone, Sprint, WorkItem, User, ExecutionOverview, HorizonBoard as HorizonBoardData } from "../api/types"
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

// Andamento derivado dos itens (o backend calcula; aqui só se lê). O status
// gravado continua existindo — este é o que não envelhece sozinho.
const DERIVED_LABEL: { [key: string]: string } = {
    empty: "sem itens", planned: "não começou", active: "em execução", completed: "concluída"
}
const DERIVED_CLASS: { [key: string]: string } = {
    empty: "mpm-chip--neutral", planned: "mpm-chip--neutral", active: "mpm-chip--warning", completed: "mpm-chip--success"
}
const DerivedChip = ({ derived }: { derived?: string }) =>
    !derived ? null
        : <span className={`mpm-chip ${DERIVED_CLASS[derived] || "mpm-chip--neutral"}`}
            title="Andamento calculado a partir dos itens — não é o status declarado.">
            {DERIVED_LABEL[derived] || derived}
        </span>

// Roadmap (frente A): timeline de milestones por data-alvo (progresso
// doneItems/totalItems + itens) e gestão de milestones/sprints.
const RoadmapPage = () => {
    const api = useApi()
    const readOnly = useReadOnly()
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
    // Números agregados do projeto (mesma fonte da tela de Execução).
    const [exec, setExec] = useState<ExecutionOverview | null>(null)
    // Entregas concluídas ficam fora do caminho por padrão.
    const [showDoneMilestones, setShowDoneMilestones] = useState(false)
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
        api.reports.execution(projectId, 50).then(setExec).catch(() => {})
        return Promise.all([api.planning.roadmap(projectId), api.planning.listSprints(projectId)])
            .then(([road, sp]) => { setMilestones(road || []); setSprints(sp || []) })
            .catch((e) => setError(e.message))
    }

    // Reordenar rodada: troca a posição com a vizinha. A ordem é o eixo do plano
    // quando não há datas — precisa ser editável sem abrir modal.
    const moveSprint = async (index: number, delta: number) => {
        const target = index + delta
        if (target < 0 || target >= sprints.length) return
        const a = sprints[index], b = sprints[target]
        setError(null)
        try {
            await api.planning.updateSprint(a.id, { order: typeof b.order === "number" ? b.order : target })
            await api.planning.updateSprint(b.id, { order: typeof a.order === "number" ? a.order : index })
            await load()
        } catch (e: any) { setError(e.message) }
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
            subtitle="Planejamento · onde o projeto está, entregas e rodadas de execução"
            actions={<>
                {!readOnly ? <PageFeedbackButton scope="planning" projectId={projectId} label="Todo o planejamento" compact /> : null}
                <div className="mpm-seg">
                    <button className={`mpm-seg__btn ${mode === "date" ? "is-active" : ""}`} title="Linha do tempo das entregas, ordenada pela data-alvo" onClick={() => setMode("date")}><Icon name="calendar" /> Por data</button>
                    <button className={`mpm-seg__btn ${mode === "horizon" ? "is-active" : ""}`} title="Itens agrupados por horizonte (agora/próximo/depois/talvez)" onClick={() => setMode("horizon")}><Icon name="align left" /> Por horizonte</button>
                </div>
                {!readOnly ? <button className="mpm-btn" title="Rodada: a próxima leva de trabalho a executar (datas são opcionais)" onClick={() => setSpModal({ open: true })}><Icon name="rocket" /> Nova Rodada</button> : null}
                {!readOnly ? <button className="mpm-btn mpm-btn--primary" title="Entrega: um alvo com data (milestone, no jargão técnico)" onClick={() => setMsModal({ open: true })}><Icon name="flag" /> Nova Entrega</button> : null}
            </>}
            onInspectorClose={() => setSelected(null)}>

        <ErrorBanner error={error} />

        {mode === "horizon"
            ? <HorizonBoard data={horizonData} usersById={usersById} onOpenItem={setSelected} onMoveHorizon={moveHorizon} readOnly={readOnly} />
            : loading
            ? <Loading />
            : <>
                {/* ONDE O PROJETO ESTÁ — antes das entregas, porque é a pergunta
                    que se faz ao abrir o planejamento. Mesma fonte da Execução. */}
                {exec
                    ? <div className="mpm-card mpm-plan__summary">
                        <div className="mpm-row" style={{ alignItems: "center" }}>
                            <Icon name="chart pie" />
                            <strong style={{ flex: 1 }}>Onde o projeto está</strong>
                            <span className="mpm-mono mpm-muted">
                                {exec.counts.done}/{exec.counts.total} · {exec.counts.total ? Math.round((exec.counts.done / exec.counts.total) * 100) : 0}%
                            </span>
                        </div>
                        <div style={{ marginTop: "var(--mp-space-2)" }}>
                            <Progress value={exec.counts.total ? Math.round((exec.counts.done / exec.counts.total) * 100) : 0} />
                        </div>
                        <div className="mpm-exec__counts">
                            <span><strong>{exec.counts.done}</strong> concluídos</span>
                            <span><strong>{exec.counts.now}</strong> em execução</span>
                            <span><strong>{exec.counts.queue}</strong> na fila</span>
                            <span><strong>{exec.counts.blocked}</strong> bloqueados</span>
                            <span><strong>{Math.max(0, exec.counts.notReady)}</strong> ainda não prontos</span>
                            <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ marginLeft: "auto" }}
                                onClick={() => navigate(`/projects/${projectId}/execution`)}>
                                <Icon name="play circle" /> ver execução
                            </button>
                        </div>
                    </div>
                    : null}

                {(() => {
                    // Entrega 100% concluída sai da frente: o plano é sobre o que
                    // falta. O histórico continua a um clique.
                    const isDone = (m: Milestone) =>
                        (m.derivedStatus === "completed") ||
                        (typeof m.progress === "number" && m.progress === 100 && (m.totalItems || 0) > 0)
                    const doneMilestones = milestones.filter(isDone)
                    const activeMilestones = milestones.filter((m) => !isDone(m))
                    const shown = showDoneMilestones ? milestones : activeMilestones
                    return <div className="mpm-panel">
                    <div className="mpm-panel__title">
                        <Icon name="road" /> Entregas ({activeMilestones.length}
                        {doneMilestones.length ? ` de ${milestones.length}` : ""})
                        {doneMilestones.length
                            ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ marginLeft: "auto" }}
                                onClick={() => setShowDoneMilestones((v) => !v)}>
                                {showDoneMilestones
                                    ? "esconder concluídas"
                                    : `mostrar ${doneMilestones.length} concluída${doneMilestones.length > 1 ? "s" : ""}`}
                            </button>
                            : null}
                    </div>
                    {shown.length === 0
                        ? <EmptyState icon="flag outline" title={milestones.length ? "Todas as entregas concluídas" : "Sem entregas"}
                            hint={milestones.length ? "Nada em aberto no plano." : "Crie uma entrega (um alvo com data) para montar o plano."} />
                        : <div className="mpm-timeline">
                            {shown.map((m) => {
                                const total = m.totalItems || 0
                                const done = m.doneItems || 0
                                const progress = typeof m.progress === "number" ? m.progress : (total ? Math.round((done / total) * 100) : 0)
                                return <div key={m.id} className="mpm-card mpm-col mpm-gap-4">
                                    <div className="mpm-row">
                                        <Icon name="flag" />
                                        <strong style={{ fontSize: "var(--mp-text-lg)", flex: 1 }}>{m.name}</strong>
                                        <DerivedChip derived={m.derivedStatus} />
                                        <StatusChip status={m.status} />
                                        {m.targetDate ? <span className="mpm-chip mpm-chip--info"><Icon name="calendar" /> {formatDate(m.targetDate)}</span> : null}
                                        {!readOnly ? <Icon name="pencil" link className="mpm-muted" onClick={() => setMsModal({ open: true, milestone: m })} /> : null}
                                        {!readOnly ? <Icon name="trash" link className="mpm-muted" onClick={() => setPendingDelete({ kind: "milestone", id: m.id, name: m.name })} /> : null}
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
                })()}

                {/* RODADAS: a sequência de execução. A ORDEM é o eixo — a data é
                    opcional, e a maioria dos projetos daqui não usa calendário. */}
                <div className="mpm-panel">
                    <div className="mpm-panel__title">
                        <Icon name="rocket" /> Rodadas ({sprints.length})
                        <span className="mpm-muted" style={{ marginLeft: "var(--mp-space-2)", fontSize: "var(--mp-text-xs)", fontWeight: 400 }}>
                            executadas nesta ordem
                        </span>
                    </div>
                    {sprints.length === 0
                        ? <EmptyState icon="rocket" title="Sem rodadas"
                            hint="Uma rodada é a leva de trabalho que será executada em seguida. Datas são opcionais — o que manda é a ordem." />
                        : <div className="mpm-scroll-x"><table className="mpm-table">
                            <thead><tr>
                                <th style={{ width: 40 }}>#</th><th>Rodada</th><th>Andamento</th>
                                <th>Período</th><th>Progresso</th><th style={{ width: 120 }} />
                            </tr></thead>
                            <tbody>
                                {sprints.map((s, index) => {
                                    const progress = typeof s.progress === "number" ? s.progress : 0
                                    const period = s.startDate || s.endDate
                                        ? `${formatDate(s.startDate)}${s.endDate ? ` → ${formatDate(s.endDate)}` : ""}`
                                        : "—"
                                    return <tr key={s.id}>
                                        <td className="mpm-mono mpm-muted">{index + 1}</td>
                                        <td>
                                            <strong>{s.name}</strong>
                                            {s.goal ? <div className="mpm-muted" style={{ fontSize: "12px" }}>{s.goal}</div> : null}
                                            <div className="mpm-muted" style={{ fontSize: "12px" }}>
                                                {s.doneItems || 0}/{s.totalItems || 0} itens
                                            </div>
                                        </td>
                                        <td><span className="mpm-row" style={{ gap: "var(--mp-space-1)" }}>
                                            <DerivedChip derived={s.derivedStatus} />
                                            <StatusChip status={s.status} />
                                        </span></td>
                                        <td className="mpm-muted">{period}</td>
                                        <td style={{ minWidth: 120 }}><Progress value={progress} /><span className="mpm-mono mpm-muted">{progress}%</span></td>
                                        <td><span className="mpm-row">
                                            {!readOnly
                                                ? <>
                                                    <Icon name="arrow up" link className="mpm-muted" title="Executar antes"
                                                        style={index === 0 ? { opacity: 0.3, pointerEvents: "none" } : undefined}
                                                        onClick={() => moveSprint(index, -1)} />
                                                    <Icon name="arrow down" link className="mpm-muted" title="Executar depois"
                                                        style={index === sprints.length - 1 ? { opacity: 0.3, pointerEvents: "none" } : undefined}
                                                        onClick={() => moveSprint(index, 1)} />
                                                </>
                                                : null}
                                            {!readOnly ? <Icon name="pencil" link className="mpm-muted" onClick={() => setSpModal({ open: true, sprint: s })} /> : null}
                                            {!readOnly ? <Icon name="trash" link className="mpm-muted" onClick={() => setPendingDelete({ kind: "sprint", id: s.id, name: s.name })} /> : null}
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
                title={pendingDelete.kind === "milestone" ? "Excluir entrega" : "Excluir rodada"}
                danger
                message={<>Excluir {pendingDelete.kind === "milestone" ? "a entrega" : "a rodada"} <strong>{pendingDelete.name}</strong>?</>}
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
