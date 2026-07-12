import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, ProjectMetrics, Board, ActivityEntry, User, WorkItem } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import NewBoardModal from "../Components/NewBoardModal"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import AuditTimeline from "../Components/AuditTimeline"
import WorkItemInspector from "../Components/WorkItemInspector"
import Markdown from "../Components/Markdown"
import DescriptionEditor from "../Components/DescriptionEditor"
import { Metric, Progress, StatusChip, TypeBadge, Loading, ErrorBanner } from "../Components/Primitives"
import { formatDateTime } from "../Utils/format"
import { activityTitle, activityDetail, activityIcon, activityItemId } from "../Utils/activity"
import downloadJson from "../Utils/downloadJson"
import { feedbackTarget } from "../Utils/feedbackTarget"
import useFeedback from "../Hooks/useFeedback"

type OverviewTab = "resumo" | "relatorio" | "auditoria"
const OVERVIEW_TABS: { key: OverviewTab; label: string; icon: any; hint: string }[] = [
    { key: "resumo",    label: "Visão geral",    icon: "home",           hint: "Descrição do projeto, boards e atividade recente" },
    { key: "relatorio", label: "Relatório Final", icon: "file alternate outline", hint: "Relatório de conclusão do projeto — panorama do que foi feito, com links" },
    { key: "auditoria", label: "Auditoria",      icon: "history",        hint: "Tudo que humanos e agentes fizeram neste projeto" }
]

// Só agrupa eventos consecutivos cuja FRASE é idêntica (ex.: 12 vínculos criados
// em lote). Ações distintas nunca colapsam — senão o conteúdo se perde.
interface ActivityGroup { entry: ActivityEntry; text: string; count: number }
const groupActivity = (entries: ActivityEntry[], usersById: Record<string, User>): ActivityGroup[] => {
    const out: ActivityGroup[] = []
    for (const e of entries) {
        const text = activityTitle(e, usersById)
        const last = out[out.length - 1]
        if (last && last.text === text) last.count += 1
        else out.push({ entry: e, text, count: 1 })
    }
    return out
}

// ProjectPage / Overview: header enxuto, PROGRESSO NO TOPO e o resto em abas.
const ProjectPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const feedback = useFeedback()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [metrics, setMetrics] = useState<ProjectMetrics | null>(null)
    const [boards, setBoards] = useState<Board[]>([])
    const [activity, setActivity] = useState<ActivityEntry[]>([])
    const [error, setError] = useState<string | null>(null)
    const [creatingBoard, setCreatingBoard] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [tab, setTab] = useState<OverviewTab>("resumo")
    const [moreOpen, setMoreOpen] = useState(false)
    // Painel "Requer atenção": itens bloqueados e atrasados (via reports).
    const [attention, setAttention] = useState<{ blocked: WorkItem[]; overdue: WorkItem[] }>({ blocked: [], overdue: [] })
    // Descrição do projeto: leitura por padrão, editor rico (markdown + imagem) sob demanda.
    const [editingDesc, setEditingDesc] = useState(false)
    const [editingReport, setEditingReport] = useState(false)
    const [users, setUsers] = useState<User[]>([])
    // Item aberto a partir de uma referência (CFGEC-26) citada na descrição do projeto.
    const [selected, setSelected] = useState<string | null>(null)
    const usersById = React.useMemo(() => {
        const m: Record<string, User> = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const loadAll = useCallback(() => {
        if (!projectId) return
        setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.projects.metrics(projectId).then(setMetrics).catch(() => {})
        api.boards.list(projectId).then((l) => setBoards(l || [])).catch(() => {})
        api.reports.activity({ project: projectId, limit: "20" }).then((l) => setActivity(l || [])).catch(() => {})
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
        Promise.all([api.reports.blocked(projectId), api.reports.overdue(projectId)])
            .then(([b, o]) => setAttention({ blocked: (b as WorkItem[]) || [], overdue: (o as WorkItem[]) || [] }))
            .catch(() => setAttention({ blocked: [], overdue: [] }))
    }, [projectId, api])

    // Drill-down de métrica: grava o filtro no mesmo storage que a lista lê e
    // navega para a Lista já filtrada (a lista carrega o filtro ao montar).
    const drillTo = (filters: Record<string, string>) => {
        if (!projectId) return
        try {
            const key = `mpm-filters:workspace:${projectId}`
            const raw = window.localStorage.getItem(key)
            const cur = raw ? JSON.parse(raw) : { filters: {}, group: "none" }
            cur.filters = filters
            window.localStorage.setItem(key, JSON.stringify(cur))
        } catch (_) { /* storage indisponível: navega sem filtro */ }
        navigate(`/projects/${projectId}/list`)
    }

    useEffect(() => { loadAll() }, [loadAll])
    // Um agente mexeu neste projeto: métricas, boards e atividade se atualizam sozinhos.
    useLiveReload(loadAll, { projectId })

    const exportProject = async () => {
        if (!projectId) return
        try { downloadJson(await api.system.exportProject(projectId), `project-${project ? project.slug : projectId}`) }
        catch (e: any) { setError(e.message) }
    }

    const openBoard = (boardId?: string) =>
        navigate(boardId ? `/projects/${projectId}/board/${boardId}` : `/projects/${projectId}/board`)

    const reloadProject = async () => {
        try { setProject(await api.projects.get(projectId)) } catch (e: any) { setError(e.message) }
    }
    const archive = async () => {
        try { await api.projects.archive(projectId); await reloadProject() } catch (e: any) { setError(e.message) }
    }
    const restore = async () => {
        try { await api.projects.restore(projectId); await reloadProject() } catch (e: any) { setError(e.message) }
    }
    const doRemoveProject = async () => {
        setDeleting(true); setError(null)
        try { await api.projects.remove(projectId); navigate("/") }
        catch (e: any) { setError(e.message); setDeleting(false); setConfirmDelete(false) }
    }

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} />
        : undefined

    // Ações do projeto: vivem no header. As de risco ficam atrás do menu "Mais".
    const headerActions = project
        ? <>
            <StatusChip status={project.status} />
            <PageFeedbackButton scope="project" projectId={projectId} label="Projeto inteiro" />
            <button className="mpm-btn" title="Abrir o board padrão do projeto" onClick={() => openBoard(project.defaultBoardId)}>
                <Icon name="columns" /> Abrir board
            </button>
            <button className="mpm-btn" title="Exportar projeto (.json)" onClick={exportProject}>
                <Icon name="download" /> Exportar
            </button>
            <div className="mpm-more">
                <button className="mpm-btn" title="Mais ações" onClick={() => setMoreOpen((v) => !v)}>
                    <Icon name="ellipsis horizontal" /> Mais
                </button>
                {moreOpen
                    ? <div className="mpm-more__menu" onMouseLeave={() => setMoreOpen(false)}>
                        {project.status === "archived"
                            ? <button className="mpm-ctxmenu__item" onClick={() => { setMoreOpen(false); restore() }}>
                                <Icon name="undo" /> Restaurar projeto
                            </button>
                            : <button className="mpm-ctxmenu__item" onClick={() => { setMoreOpen(false); archive() }}>
                                <Icon name="archive" /> Arquivar projeto
                            </button>}
                        <div className="mpm-ctxmenu__sep" />
                        <button className="mpm-ctxmenu__item mpm-ctxmenu__item--danger"
                            onClick={() => { setMoreOpen(false); setConfirmDelete(true) }}>
                            <Icon name="trash" /> Excluir projeto…
                        </button>
                    </div>
                    : null}
            </div>
        </>
        : undefined

    // Referências a itens (CFGEC-26…) na descrição do projeto abrem o inspector.
    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell active="overview" activeProjectId={projectId} activeProjectName={project ? project.name : undefined}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle={project
                ? <>
                    {project.shortDescription ? <div>{project.shortDescription}</div> : null}
                    <span className="mpm-mono">{project.keyPrefix} · {project.slug}</span>
                </>
                : undefined}
            actions={headerActions}
            inspector={inspector} onInspectorClose={() => setSelected(null)}>
        <ErrorBanner error={error} />
        {!project
            ? <Loading />
            : <>
                {/* PROGRESSO NO TOPO: antes a descrição longa o empurrava para fora da tela. */}
                {metrics
                    ? <div className="mpm-card">
                        <div className="mpm-row" style={{ marginBottom: "var(--mp-space-3)" }}>
                            <strong style={{ flex: 1 }}>Progresso</strong>
                            <span className="mpm-mono">{metrics.progress}%</span>
                        </div>
                        <Progress value={metrics.progress} />
                        <div className="mpm-metrics-row" style={{ marginTop: "var(--mp-space-4)" }}>
                            <Metric value={metrics.total} label="Total"
                                tip="Todos os itens do projeto. Abre a lista completa." onClick={() => drillTo({})} />
                            <Metric value={metrics.done} label="Concluídos"
                                tip="Itens em colunas de conclusão. Abre a lista filtrada por concluídos." onClick={() => drillTo({ status: "done" })} />
                            <Metric value={metrics.inProgress} label="Em progresso"
                                tip="Itens com status 'em progresso'. Abre a lista filtrada." onClick={() => drillTo({ status: "in-progress" })} />
                            <Metric value={metrics.blocked} label="Bloqueados"
                                tip="Status 'bloqueado' ou com motivo de bloqueio. Abre a lista filtrada." onClick={() => drillTo({ status: "blocked" })} />
                            <Metric value={metrics.overdue} label="Atrasados"
                                tip="Com prazo vencido e ainda não concluídos. Listados em 'Requer atenção' abaixo." />
                            <Metric value={metrics.stories} label="Histórias"
                                tip="Itens do tipo história. Abre a lista filtrada por tipo." onClick={() => drillTo({ type: "story" })} />
                            <Metric value={metrics.tasks} label="Tarefas"
                                tip="Itens do tipo tarefa. Abre a lista filtrada por tipo." onClick={() => drillTo({ type: "task" })} />
                        </div>
                    </div>
                    : null}

                {/* Requer atenção: o que trava o projeto, do mais grave ao menos.
                    Cada linha abre o item. */}
                {(() => {
                    const overdueOnly = attention.overdue.filter((o) => !attention.blocked.some((b) => b.id === o.id))
                    if (attention.blocked.length === 0 && overdueOnly.length === 0) return null
                    const row = (it: WorkItem, kind: "blocked" | "overdue") =>
                        <button key={`${kind}-${it.id}`} className="mpm-attention__row" onClick={() => setSelected(it.id)}>
                            <TypeBadge type={it.type} short />
                            <span className="mpm-mono mpm-muted">{it.key}</span>
                            <span className="mpm-attention__title" title={it.title}>{it.title}</span>
                            <span className={`mpm-chip ${kind === "blocked" ? "mpm-chip--danger" : "mpm-chip--warning"}`}>
                                {kind === "blocked" ? (it.blockedReason || "bloqueado") : "atrasado"}
                            </span>
                        </button>
                    return <div className="mpm-card mpm-attention">
                        <div className="mpm-row" style={{ marginBottom: "var(--mp-space-2)" }}>
                            <Icon name="exclamation triangle" className="mpm-attention__ico" />
                            <strong style={{ flex: 1 }}>Requer atenção</strong>
                            <span className="mpm-muted mpm-mono">{attention.blocked.length + overdueOnly.length}</span>
                        </div>
                        <div className="mpm-col" style={{ gap: "var(--mp-space-1)" }}>
                            {attention.blocked.map((it) => row(it, "blocked"))}
                            {overdueOnly.map((it) => row(it, "overdue"))}
                        </div>
                    </div>
                })()}

                {/* Tabs: aproveita a tela pequena em vez de empilhar tudo. */}
                <div className="mpm-tabs" role="tablist">
                    {OVERVIEW_TABS.map((t) =>
                        <button key={t.key} role="tab" title={t.hint}
                            className={`mpm-tab ${tab === t.key ? "is-active" : ""}`}
                            onClick={() => setTab(t.key)}>
                            <Icon name={t.icon} /> <span>{t.label}</span>
                        </button>)}
                </div>

                {tab === "resumo"
                    ? <div className="mpm-overview">
                        {/* A descrição é o que a pessoa (e o agente) precisa ler primeiro. */}
                        <div className="mpm-overview__main">
                            <div className="mpm-panel">
                                <div className="mpm-panel__title">
                                    <Icon name="align left" /> Descrição
                                    <span style={{ marginLeft: "auto" }} />
                                    {!editingDesc
                                        ? <button className="mpm-btn mpm-btn--sm" title="Editar a descrição em markdown (aceita imagens)"
                                            onClick={() => setEditingDesc(true)}>
                                            <Icon name="pencil" /> Editar
                                        </button>
                                        : null}
                                    {/* Sugerir ao agente uma melhoria no texto do projeto.
                                        O balão abre logo abaixo do ícone. */}
                                    <span className="mpm-iconbtn"
                                        title="Feedback para o agente sobre a descrição do projeto"
                                        onClick={(e) => {
                                            const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                            feedback.openAt({
                                                x: box.right - 380, y: box.bottom + 6,
                                                target: {
                                                    entityType: "project", entityId: project.id, project: project.id,
                                                    field: "description", fieldLabel: "Descrição do projeto"
                                                },
                                                // trecho, não o texto todo: é só contexto para o agente
                                                excerpt: project.description ? project.description.slice(0, 500) : undefined,
                                                screen: window.location.hash || window.location.pathname
                                            })
                                        }}>
                                        <Icon name="comment alternate outline" />
                                    </span>
                                </div>
                                {editingDesc
                                    ? <div className="mpm-desc mpm-desc--inline"
                                        {...feedbackTarget({ entityType: "project", entityId: project.id, project: project.id, field: "description", fieldLabel: "Descrição do projeto" })}>
                                        <DescriptionEditor key={`proj-desc-${project.id}`} value={project.description || ""}
                                            label="descrição do projeto"
                                            onSave={(md) => api.projects.update(project.id, { description: md }).then(setProject).catch((e) => setError(e.message))}
                                            onDone={() => setEditingDesc(false)} />
                                    </div>
                                    : project.description
                                    ? <div {...feedbackTarget({ entityType: "project", entityId: project.id, project: project.id, field: "description", fieldLabel: "Descrição do projeto" })}>
                                        <Markdown>{project.description}</Markdown>
                                    </div>
                                    : <div className="mpm-tabpanel-empty">
                                        <Icon name="align left" size="large" />
                                        <div>Este projeto ainda não tem descrição.</div>
                                        <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setEditingDesc(true)}>
                                            <Icon name="pencil" /> Escrever descrição
                                        </button>
                                    </div>}
                            </div>
                        </div>

                        <aside className="mpm-overview__side">
                        <div className="mpm-panel">
                            <div className="mpm-panel__title">
                                <Icon name="columns" /> Boards ({boards.length})
                                <button className="mpm-btn mpm-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setCreatingBoard(true)}>
                                    <Icon name="plus" /> Novo Board
                                </button>
                            </div>
                            {boards.length === 0
                                ? <div className="mpm-tabpanel-empty">
                                    <Icon name="columns" size="large" />
                                    <div>Nenhum board neste projeto.</div>
                                    <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setCreatingBoard(true)}>
                                        <Icon name="plus" /> Criar board
                                    </button>
                                </div>
                                : <div className="mpm-col">
                                    {boards.map((b) =>
                                        <div key={b.id} className="mpm-nav__item" onClick={() => openBoard(b.id)}>
                                            <Icon name="columns" /> {b.name}
                                            {b.isDefault ? <span className="mpm-chip mpm-chip--info" style={{ marginLeft: "auto" }}>padrão</span> : null}
                                        </div>)}
                                </div>}
                        </div>

                        <div className="mpm-panel">
                            <div className="mpm-panel__title">
                                <Icon name="history" /> Atividade recente
                                <button className="mpm-btn mpm-btn--sm mpm-btn--ghost" style={{ marginLeft: "auto" }}
                                    title="Abrir a auditoria completa deste projeto"
                                    onClick={() => navigate(`/audit?project=${projectId}`)}>
                                    ver tudo
                                </button>
                            </div>
                            {activity.length === 0
                                ? <div className="mpm-tabpanel-empty"><Icon name="history" size="large" /><div>Sem atividade ainda.</div></div>
                                : <div className="mpm-timeline">
                                    {groupActivity(activity, usersById).slice(0, 10).map((g) => {
                                    // Clique abre o item completo (quando o evento é de um item).
                                    const itemId = activityItemId(g.entry)
                                    return <div key={g.entry.id}
                                        className={`mpm-timeline__item mpm-activity ${itemId ? "is-openable" : ""}`}
                                        title={itemId ? `Abrir o item — ${activityDetail(g.entry)}` : activityDetail(g.entry)}
                                        onClick={itemId ? () => setSelected(itemId) : undefined}>
                                            <span className="mpm-avatar">
                                                <Icon name={activityIcon(g.entry.action)} size="small" style={{ margin: 0 }} />
                                            </span>
                                            <div className="mpm-timeline__body" style={{ minWidth: 0 }}>
                                                <div className="mpm-activity__text">
                                                    {g.text}
                                                    {g.count > 1 ? <span className="mpm-chip mpm-chip--neutral">×{g.count}</span> : null}
                                                </div>
                                                <div className="mpm-activity__meta mpm-mono">
                                                    {g.entry.actorType === "agent" && g.entry.model ? <span>{g.entry.model}</span> : null}
                                                    <span>{g.entry.source}</span>
                                                    <span>{formatDateTime(g.entry.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    })}
                                </div>}
                        </div>
                        </aside>
                    </div>
                    : null}

                {tab === "relatorio"
                    ? <div className="mpm-panel">
                        <div className="mpm-panel__title">
                            <Icon name="file alternate outline" /> Relatório Final
                            {!editingReport
                                ? <button className="mpm-btn mpm-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setEditingReport(true)}>
                                    <Icon name="pencil" /> Editar
                                </button>
                                : null}
                        </div>
                        {editingReport
                            ? <div className="mpm-desc mpm-desc--inline"
                                {...feedbackTarget({ entityType: "project", entityId: project.id, project: project.id, field: "finalReport", fieldLabel: "Relatório final do projeto" })}>
                                <DescriptionEditor key={`proj-report-${project.id}`} value={project.finalReport || ""}
                                    label="relatório final do projeto"
                                    onSave={(md) => api.projects.update(project.id, { finalReport: md }).then(setProject).catch((e) => setError(e.message))}
                                    onDone={() => setEditingReport(false)} />
                            </div>
                            : project.finalReport
                            ? <div {...feedbackTarget({ entityType: "project", entityId: project.id, project: project.id, field: "finalReport", fieldLabel: "Relatório final do projeto" })}>
                                <Markdown>{project.finalReport}</Markdown>
                            </div>
                            : <div className="mpm-tabpanel-empty">
                                <Icon name="file alternate outline" size="large" />
                                <div>Este projeto ainda não tem relatório final.</div>
                                <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setEditingReport(true)}>
                                    <Icon name="pencil" /> Escrever relatório
                                </button>
                            </div>}
                    </div>
                    : null}

                {tab === "auditoria"
                    ? <div className="mpm-panel"><AuditTimeline projectId={projectId} limit={40} /></div>
                    : null}
            </>}

        {creatingBoard && projectId
            ? <NewBoardModal projectId={projectId}
                onClose={() => setCreatingBoard(false)}
                onCreated={(b) => { setCreatingBoard(false); openBoard(b.id) }} />
            : null}

        {confirmDelete && project
            ? <ConfirmActionModal
                title="Excluir projeto"
                danger
                message={<>Isto remove o projeto <strong>{project.name}</strong> da lista (soft delete — reversível por um administrador).</>}
                consequences={[
                    <>O projeto some das listagens e da navegação.</>,
                    metrics ? <>{metrics.total} item(ns) e {boards.length} board(s) deixam de aparecer.</> : <>Boards e itens deixam de aparecer.</>
                ]}
                requireText={project.name}
                confirmLabel="Excluir projeto"
                busy={deleting}
                error={error}
                onConfirm={doRemoveProject}
                onCancel={() => setConfirmDelete(false)} />
            : null}
        </AppShell>
    </ItemNavigatorProvider>
}

export default ProjectPage
