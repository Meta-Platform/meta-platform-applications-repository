import * as React from "react"
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Project, ProjectMetrics, Board, ActivityEntry } from "../api/types"
import AppShell from "../Components/AppShell"
import NewBoardModal from "../Components/NewBoardModal"
import Markdown from "../Components/Markdown"
import { Metric, Progress, StatusChip, Loading, ErrorBanner } from "../Components/Primitives"
import { formatDateTime, humanizeAction } from "../Utils/format"

// ProjectPage / Overview (spec §11): nome, descrição, progresso (ProjectMetrics),
// boards e atividade recente.
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

    useEffect(() => {
        if (!projectId) return
        setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.projects.metrics(projectId).then(setMetrics).catch(() => {})
        api.boards.list(projectId).then((l) => setBoards(l || [])).catch(() => {})
        api.reports.activity({ project: projectId, limit: "20" }).then((l) => setActivity(l || [])).catch(() => {})
    }, [projectId, api])

    const openBoard = (boardId?: string) =>
        navigate(boardId ? `/projects/${projectId}/board/${boardId}` : `/projects/${projectId}/board`)

    return <AppShell active="overview" activeProjectId={projectId} activeProjectName={project ? project.name : undefined}>
        <ErrorBanner error={error} />
        {!project
            ? <Loading />
            : <>
                <div className="mpm-page-head">
                    <div className="mpm-page-head__titles">
                        <h1 className="mpm-page-title">{project.name}</h1>
                        <div className="mpm-page-subtitle mpm-mono">{project.keyPrefix} · {project.slug}</div>
                    </div>
                    <div className="mpm-page-head__actions">
                        <StatusChip status={project.status} />
                        <button className="mpm-btn" onClick={() => openBoard(project.defaultBoardId)}><Icon name="columns" /> Board</button>
                        <button className="mpm-btn" onClick={() => navigate(`/projects/${projectId}/list`)}><Icon name="list" /> Lista</button>
                        <button className="mpm-btn" onClick={() => navigate(`/projects/${projectId}/backlog`)}><Icon name="clipboard list" /> Backlog</button>
                        <button className="mpm-btn" onClick={() => navigate(`/projects/${projectId}/inbox`)}><Icon name="inbox" /> Inbox</button>
                        <button className="mpm-btn" onClick={() => navigate(`/projects/${projectId}/roadmap`)}><Icon name="road" /> Roadmap</button>
                    </div>
                </div>

                {project.description
                    ? <div className="mpm-panel"><Markdown>{project.description}</Markdown></div>
                    : null}

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

                <div className="mpm-grid-cards">
                    <div className="mpm-panel">
                        <div className="mpm-panel__title">
                            <Icon name="columns" /> Boards ({boards.length})
                            <button className="mpm-btn mpm-btn--sm" style={{ marginLeft: "auto" }} onClick={() => setCreatingBoard(true)}>
                                <Icon name="plus" /> Novo Board
                            </button>
                        </div>
                        {boards.length === 0
                            ? <div className="mpm-muted" style={{ fontSize: "12px" }}>nenhum board</div>
                            : <div className="mpm-col">
                                {boards.map((b) =>
                                    <div key={b.id} className="mpm-nav__item" onClick={() => openBoard(b.id)}>
                                        <Icon name="columns" /> {b.name}
                                        {b.isDefault ? <span className="mpm-chip mpm-chip--info" style={{ marginLeft: "auto" }}>padrão</span> : null}
                                    </div>)}
                            </div>}
                    </div>

                    <div className="mpm-panel">
                        <div className="mpm-panel__title"><Icon name="history" /> Atividade recente</div>
                        {activity.length === 0
                            ? <div className="mpm-muted" style={{ fontSize: "12px" }}>sem atividade</div>
                            : <div className="mpm-timeline">
                                {activity.slice(0, 12).map((e) =>
                                    <div key={e.id} className="mpm-timeline__item">
                                        <span className="mpm-avatar"><Icon name="dot circle" size="small" style={{ margin: 0 }} /></span>
                                        <div className="mpm-timeline__body">
                                            <div className="mpm-timeline__meta">
                                                <strong>{humanizeAction(e.action)}</strong>
                                                <span className="mpm-mono">{e.entityType}</span>
                                                <span>{formatDateTime(e.createdAt)}</span>
                                            </div>
                                        </div>
                                    </div>)}
                            </div>}
                    </div>
                </div>
            </>}

        {creatingBoard && projectId
            ? <NewBoardModal projectId={projectId}
                onClose={() => setCreatingBoard(false)}
                onCreated={(b) => { setCreatingBoard(false); openBoard(b.id) }} />
            : null}
    </AppShell>
}

export default ProjectPage
