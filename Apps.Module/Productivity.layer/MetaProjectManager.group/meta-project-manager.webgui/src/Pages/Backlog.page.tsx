import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { useReadOnly } from "../Hooks/useReadOnly"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import useItemFilters from "../Hooks/useItemFilters"
import { Project, WorkItem, User, Milestone, Sprint } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import WorkItemInspector from "../Components/WorkItemInspector"
import ItemFilterBar from "../Components/ItemFilterBar"
import {
    TypeBadge, PriorityBadge, ValueBadge, EffortBadge, AreaBadge, HorizonChip,
    StatusChip, Avatar, ItemMeta, Loading, EmptyState, ErrorBanner
} from "../Components/Primitives"
import { summarize } from "../Utils/summary"

// Status terminais: um item aqui já saiu do backlog (foi concluído/arquivado).
const DONE_STATUSES = new Set(["done", "archived", "completed"])

// BacklogPage: backlog priorizado por VALOR (sort=value).
//
// É uma LISTA, não uma tabela: quem prioriza precisa LER o item, e as colunas de
// edição inline (horizonte, entrega, sprint) espremiam o título em um terço da
// largura. Editar continua a um clique, no modal — a lista existe para decidir o
// que abrir.
const BacklogPage = () => {
    const api = useApi()
    const readOnly = useReadOnly()
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

    const milestonesById = useMemo(() => {
        const m: { [id: string]: Milestone } = {}
        milestones.forEach((x) => { m[x.id] = x })
        return m
    }, [milestones])

    const sprintsById = useMemo(() => {
        const m: { [id: string]: Sprint } = {}
        sprints.forEach((x) => { m[x.id] = x })
        return m
    }, [sprints])

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

    // Mudanças de agentes neste projeto entram na lista sem refresh.
    useLiveReload(loadItems, { projectId })

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

    // Backlog = trabalho POR FAZER: itens concluídos não pertencem aqui. Só
    // aparecem se o usuário filtrar explicitamente por um status terminal.
    const visibleItems = useMemo(
        () => filters.status ? items : items.filter((it) => !DONE_STATUSES.has(it.statusKey)),
        [items, filters.status]
    )

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={loadItems} />
        : undefined

    // Referências a itens (CFGEC-26…) em qualquer texto desta tela abrem o inspector.
    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell active="backlog" activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined} inspector={inspector}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Backlog" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Backlog · priorizado por valor"
            actions={readOnly ? undefined : <PageFeedbackButton scope="backlog" projectId={projectId} label="Todo o backlog" />}
            onInspectorClose={() => setSelected(null)}>

        {readOnly ? null : <div className="mpm-card">
            <div className="mpm-row">
                <input className="mpm-input" placeholder="Criação rápida: título do item + Enter"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") quickCreate() }} />
                <button className="mpm-btn mpm-btn--primary" disabled={busy || !draft.trim()} onClick={quickCreate}>
                    <Icon name="plus" /> Adicionar
                </button>
            </div>
        </div>}

        <ItemFilterBar filters={filters} setFilter={setFilter} reset={reset} activeCount={activeCount}
            users={users} milestones={milestones} sprints={sprints} />

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : visibleItems.length === 0
                ? <EmptyState icon="clipboard list" title="Nada por fazer no backlog"
                    hint={items.length > 0 ? "Todos os itens já foram concluídos. Ajuste os filtros para ver outros." : "Adicione itens acima ou ajuste os filtros."} />
                : <div className="mpm-backlog">
                    {visibleItems.map((it) => {
                        const assignee = it.assigneeUserId ? usersById[it.assigneeUserId] : undefined
                        const milestone = it.milestoneId ? milestonesById[it.milestoneId] : undefined
                        const sprint = it.sprintId ? sprintsById[it.sprintId] : undefined
                        const summary = summarize(it.description)
                        // Rodapé só existe se houver o que mostrar: senão sobraria
                        // uma linha divisória vazia embaixo de cada item.
                        const hasFoot = !!(
                            (it.value && it.value !== "none") || it.effort || it.horizon ||
                            milestone || sprint || it.blockedReason ||
                            it.commentCount || it.attachmentCount || it.progress
                        )

                        return <article key={it.id} className="mpm-backlog__item"
                            onClick={() => setSelected(it.id)} title="Abrir o item">

                            <div className="mpm-backlog__head">
                                <span className="mpm-mono mpm-muted">{it.key}</span>
                                <TypeBadge type={it.type} />
                                <PriorityBadge priority={it.priority} />
                                <StatusChip status={it.statusKey} />
                                <AreaBadge area={it.area} />
                                <span className="mpm-backlog__spacer" />
                                <Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} />
                            </div>

                            <h3 className="mpm-backlog__title">{it.title}</h3>

                            {summary ? <p className="mpm-backlog__summary">{summary}</p> : null}

                            {/* Rodapé só com o que EXISTE: campo vazio não vira ruído. */}
                            {hasFoot
                            ? <div className="mpm-backlog__foot">
                                <ValueBadge value={it.value} />
                                <EffortBadge effort={it.effort} />
                                {it.horizon ? <HorizonChip horizon={it.horizon} /> : null}
                                {milestone
                                    ? <span className="mpm-backlog__tag" title="Entrega"><Icon name="flag" />{milestone.name}</span>
                                    : null}
                                {sprint
                                    ? <span className="mpm-backlog__tag" title="Sprint"><Icon name="rocket" />{sprint.name}</span>
                                    : null}
                                <span className="mpm-backlog__spacer" />
                                <ItemMeta item={it} />
                            </div>
                            : null}
                        </article>
                    })}
                </div>}
        </AppShell>
    </ItemNavigatorProvider>
}

export default BacklogPage
