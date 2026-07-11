import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { AgentFeedback, FeedbackStatus, Project, User } from "../api/types"
import AppShell from "../Components/AppShell"
import WorkItemInspector from "../Components/WorkItemInspector"
import Markdown from "../Components/Markdown"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { formatDateTime } from "../Utils/format"

type Filter = FeedbackStatus | "all"

const FILTERS: { key: Filter; label: string; hint: string }[] = [
    { key: "open",        label: "Abertos",     hint: "Ninguém pegou ainda (ou o claim de um agente expirou)" },
    { key: "in-analysis", label: "Em análise",  hint: "Um agente pegou e está trabalhando nisso agora" },
    { key: "resolved",    label: "Resolvidos",  hint: "O agente aplicou a correção e fechou" },
    { key: "dismissed",   label: "Descartados", hint: "Você decidiu que não queria mais" },
    { key: "all",         label: "Todos",       hint: "Tudo, em qualquer estado" }
]

const STATUS_CHIP: Record<string, string> = {
    open: "mpm-chip--warning",
    "in-analysis": "mpm-chip--info",
    resolved: "mpm-chip--success",
    dismissed: "mpm-chip--neutral"
}
const STATUS_LABEL: Record<string, string> = {
    open: "aberto", "in-analysis": "em análise", resolved: "resolvido", dismissed: "descartado"
}

// Feedback de escopo (de tela) → rótulo legível do recorte criticado.
const SCOPE_LABEL: Record<string, string> = {
    project: "Projeto inteiro", planning: "Todo o planejamento", ideas: "Todas as ideias",
    board: "Board", list: "Lista", backlog: "Backlog"
}

// Tela de consulta dos feedbacks dados aos agentes. Serve nas duas rotas:
// /feedback (todos os projetos) e /projects/:projectId/feedback (só o projeto).
const FeedbackPage = () => {
    const api = useApi()
    const { projectId } = useParams<{ projectId?: string }>()

    const [items, setItems] = useState<AgentFeedback[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [filter, setFilter] = useState<Filter>("open")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [pendingDismiss, setPendingDismiss] = useState<AgentFeedback | null>(null)
    const [busy, setBusy] = useState(false)

    const projectsById = useMemo(() => {
        const map: Record<string, Project> = {}
        projects.forEach((p) => { map[p.id] = p })
        return map
    }, [projects])

    const load = useCallback(() => {
        setError(null)
        return api.feedback.list({ project: projectId, status: filter, limit: "200" })
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
            .then(() => setLoading(false))
    }, [api, projectId, filter])

    useEffect(() => { setLoading(true); load() }, [load])
    useEffect(() => {
        api.projects.list({}).then((l) => setProjects(l || [])).catch(() => {})
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
    }, [api])

    // Um agente pegou/resolveu um feedback: a lista se move sozinha.
    useLiveReload(load, { always: true })

    const dismiss = async (feedback: AgentFeedback, reason?: string) => {
        setBusy(true)
        try { await api.feedback.dismiss(feedback.id, reason); await load(); setPendingDismiss(null) }
        catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }
    const reopen = async (feedback: AgentFeedback) => {
        try { await api.feedback.reopen(feedback.id); await load() } catch (e: any) { setError(e.message) }
    }
    const release = async (feedback: AgentFeedback) => {
        try { await api.feedback.release(feedback.id); await load() } catch (e: any) { setError(e.message) }
    }

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={load} />
        : undefined

    const project = projectId ? projectsById[projectId] : undefined

    const openCount = items.filter((f) => f.status === "open").length

    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell
            active="feedback"
            activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined}
            inspector={inspector}
            onInspectorClose={() => setSelected(null)}
            breadcrumb={projectId
                ? [{ label: "Projetos", to: "/" }, { label: project ? project.name : "Projeto", to: `/projects/${projectId}` }, { label: "Feedback" }]
                : [{ label: "Feedback" }]}
            title={projectId && project ? project.name : "Feedback para os agentes"}
            subtitle={projectId
                ? "Feedback · o que você pediu para os agentes corrigirem"
                : "O que você pediu para os agentes corrigirem, em todos os projetos"}>

            <ErrorBanner error={error} />

            <div className="mpm-toolbar">
                <div className="mpm-seg">
                    {FILTERS.map((f) =>
                        <button key={f.key} title={f.hint}
                            className={`mpm-seg__btn ${filter === f.key ? "is-active" : ""}`}
                            onClick={() => setFilter(f.key)}>
                            {f.label}
                        </button>)}
                </div>
                <span className="mpm-toolbar__spacer" />
                {filter === "open" && openCount > 0
                    ? <span className="mpm-muted">{openCount} esperando um agente</span>
                    : null}
            </div>

            {loading
                ? <Loading />
                : items.length === 0
                ? <EmptyState icon="comment alternate outline"
                    title="Nenhum feedback aqui"
                    hint="Clique com o botão direito num campo (título, descrição, critérios) e escolha “Feedback para o agente” — ou use o botão “Feedback” no topo da Visão geral, Board, Lista, Backlog, Planejamento ou Ideias para comentar o recorte inteiro." />
                : <div className="mpm-col mpm-gap-3">
                    {items.map((f) => {
                        const proj = projectsById[f.projectId]
                        return <div key={f.id} className="mpm-card mpm-fb-card">
                            <div className="mpm-row">
                                <span className={`mpm-chip ${STATUS_CHIP[f.status] || "mpm-chip--neutral"}`}>
                                    {STATUS_LABEL[f.status] || f.status}
                                </span>
                                {f.fieldLabel || f.field
                                    ? <span className="mpm-chip mpm-chip--info">{f.fieldLabel || f.field}</span>
                                    : !f.workItemId && SCOPE_LABEL[f.entityType]
                                    ? <span className="mpm-chip mpm-chip--info" title="Feedback sobre um recorte inteiro do projeto">{SCOPE_LABEL[f.entityType]}</span>
                                    : null}
                                {!projectId && proj ? <span className="mpm-muted">{proj.name}</span> : null}
                                <span className="mpm-toolbar__spacer" style={{ flex: 1 }} />
                                <span className="mpm-mono mpm-muted" title={f.createdAt}>{formatDateTime(f.createdAt)}</span>
                            </div>

                            <div className="mpm-fb-card__body"><Markdown>{f.body}</Markdown></div>

                            {f.excerpt
                                ? <div className="mpm-fb-card__excerpt" title="Trecho criticado">
                                    <Icon name="quote left" className="mpm-muted" /> {f.excerpt}
                                </div>
                                : null}

                            <div className="mpm-row mpm-fb-card__meta">
                                {f.workItemId
                                    ? <button className="mpm-btn mpm-btn--sm mpm-btn--ghost" onClick={() => setSelected(f.workItemId!)}>
                                        <Icon name="external" /> abrir item
                                    </button>
                                    : null}
                                {f.status === "in-analysis"
                                    ? <span className="mpm-muted">
                                        <Icon name="microchip" /> com {f.claimedByProvider}{f.claimedByModel ? ` · ${f.claimedByModel}` : ""}
                                        {f.claimExpiresAt ? ` até ${formatDateTime(f.claimExpiresAt)}` : ""}
                                    </span>
                                    : null}
                                {f.status === "resolved" && f.resolutionNote
                                    ? <span className="mpm-muted"><Icon name="check" /> {f.resolutionNote}</span>
                                    : null}
                                {f.status === "dismissed" && f.dismissReason
                                    ? <span className="mpm-muted"><Icon name="ban" /> {f.dismissReason}</span>
                                    : null}

                                <span className="mpm-toolbar__spacer" style={{ flex: 1 }} />

                                {f.status === "in-analysis"
                                    ? <button className="mpm-btn mpm-btn--sm" title="Devolver para a fila (o agente perde o claim)"
                                        onClick={() => release(f)}>
                                        <Icon name="undo" /> devolver à fila
                                    </button>
                                    : null}
                                {f.status === "open" || f.status === "in-analysis"
                                    ? <button className="mpm-btn mpm-btn--sm mpm-btn--danger" onClick={() => setPendingDismiss(f)}>
                                        <Icon name="ban" /> descartar
                                    </button>
                                    : <button className="mpm-btn mpm-btn--sm" onClick={() => reopen(f)}>
                                        <Icon name="redo" /> reabrir
                                    </button>}
                            </div>
                        </div>
                    })}
                </div>}

            {pendingDismiss
                ? <ConfirmActionModal
                    title="Descartar feedback"
                    danger
                    message={<>Descartar este feedback? Nenhum agente vai mais recebê-lo.</>}
                    consequences={[<>Você pode reabri-lo depois pela aba “Descartados”.</>]}
                    confirmLabel="Descartar"
                    busy={busy}
                    error={error}
                    onConfirm={() => dismiss(pendingDismiss)}
                    onCancel={() => setPendingDismiss(null)} />
                : null}
        </AppShell>
    </ItemNavigatorProvider>
}

export default FeedbackPage
