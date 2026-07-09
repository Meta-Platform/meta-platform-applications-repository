import * as React from "react"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Project, ProjectMetrics, Board, ActivityEntry, User } from "../api/types"
import AppShell from "../Components/AppShell"
import NewBoardModal from "../Components/NewBoardModal"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import AuditTimeline from "../Components/AuditTimeline"
import Markdown from "../Components/Markdown"
import { Metric, Progress, StatusChip, Loading, ErrorBanner } from "../Components/Primitives"
import { formatDateTime } from "../Utils/format"
import { activityTitle, activityDetail, activityIcon } from "../Utils/activity"
import downloadJson from "../Utils/downloadJson"

type OverviewTab = "resumo" | "descricao" | "auditoria"
const OVERVIEW_TABS: { key: OverviewTab; label: string; icon: any; hint: string }[] = [
    { key: "resumo",    label: "Resumo",    icon: "home",       hint: "Boards e atividade recente" },
    { key: "descricao", label: "Descrição", icon: "align left", hint: "Descrição longa do projeto" },
    { key: "auditoria", label: "Auditoria", icon: "history",    hint: "Tudo que humanos e agentes fizeram neste projeto" }
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
    const [users, setUsers] = useState<User[]>([])
    const usersById = React.useMemo(() => {
        const m: Record<string, User> = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    useEffect(() => {
        if (!projectId) return
        setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.projects.metrics(projectId).then(setMetrics).catch(() => {})
        api.boards.list(projectId).then((l) => setBoards(l || [])).catch(() => {})
        api.reports.activity({ project: projectId, limit: "20" }).then((l) => setActivity(l || [])).catch(() => {})
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
    }, [projectId, api])

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

    return <AppShell active="overview" activeProjectId={projectId} activeProjectName={project ? project.name : undefined}>
        <ErrorBanner error={error} />
        {!project
            ? <Loading />
            : <>
                <div className="mpm-page-head">
                    <div className="mpm-page-head__titles">
                        <h1 className="mpm-page-title">{project.name}</h1>
                        {project.shortDescription
                            ? <div className="mpm-page-subtitle">{project.shortDescription}</div>
                            : null}
                        <div className="mpm-page-subtitle mpm-mono">{project.keyPrefix} · {project.slug}</div>
                    </div>
                    {/* Header enxuto: a navegação do projeto já vive na sidebar.
                        Ações de risco ficam atrás do menu "Mais". */}
                    <div className="mpm-page-head__actions">
                        <StatusChip status={project.status} />
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
                    </div>
                </div>

                {/* PROGRESSO NO TOPO: antes a descrição longa o empurrava para fora da tela. */}
                {metrics
                    ? <div className="mpm-card">
                        <div className="mpm-row" style={{ marginBottom: "var(--mp-space-3)" }}>
                            <strong style={{ flex: 1 }}>Progresso</strong>
                            <span className="mpm-mono">{metrics.progress}%</span>
                        </div>
                        <Progress value={metrics.progress} />
                        <div className="mpm-metrics-row" style={{ marginTop: "var(--mp-space-4)" }}>
                            <Metric value={metrics.total} label="Total" />
                            <Metric value={metrics.done} label="Concluídos" />
                            <Metric value={metrics.inProgress} label="Em progresso" />
                            <Metric value={metrics.blocked} label="Bloqueados" />
                            <Metric value={metrics.overdue} label="Atrasados" />
                            <Metric value={metrics.stories} label="Histórias" />
                            <Metric value={metrics.tasks} label="Tarefas" />
                        </div>
                    </div>
                    : null}

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
                    ? <div className="mpm-overview-grid">
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
                                    {groupActivity(activity, usersById).slice(0, 10).map((g) =>
                                        <div key={g.entry.id} className="mpm-timeline__item mpm-activity"
                                            title={activityDetail(g.entry)}>
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
                                        </div>)}
                                </div>}
                        </div>
                    </div>
                    : null}

                {tab === "descricao"
                    ? <div className="mpm-panel">
                        {project.description
                            ? <Markdown>{project.description}</Markdown>
                            : <div className="mpm-tabpanel-empty">
                                <Icon name="align left" size="large" />
                                <div>Este projeto ainda não tem descrição.</div>
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
}

export default ProjectPage
