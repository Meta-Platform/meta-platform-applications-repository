import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, WorkItem, User, CLARITY_STATES } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import WorkItemInspector from "../Components/WorkItemInspector"
import { TypeBadge, ValueBadge, EffortBadge, AreaBadge, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"

// Horizontes de triagem (para onde uma ideia da inbox pode ir).
const PROMOTE: { key: string; label: string; icon: any }[] = [
    { key: "now", label: "Agora", icon: "bolt" },
    { key: "next", label: "Próximo", icon: "step forward" },
    { key: "later", label: "Depois", icon: "clock outline" },
    { key: "maybe", label: "Talvez", icon: "question" }
]

// InboxPage (Fase 2): captura rápida de ideias + triagem para o backlog.
const InboxPage = () => {
    const api = useApi()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [items, setItems] = useState<WorkItem[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [draft, setDraft] = useState("")
    const [busy, setBusy] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)

    const usersById = useMemo(() => {
        const m: { [id: string]: User } = {}
        users.forEach((u) => { m[u.id] = u })
        return m
    }, [users])

    const loadItems = () => {
        if (!projectId) return Promise.resolve()
        return api.items.list(projectId, { horizon: "inbox", sort: "created" })
            .then((l) => setItems(l || []))
            .catch((e) => setError(e.message))
    }

    // Mudanças de agentes neste projeto entram na lista sem refresh.
    useLiveReload(loadItems, { projectId })

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        Promise.all([api.projects.get(projectId), api.users.list({})])
            .then(([p, u]) => { setProject(p); setUsers(u || []) })
            .catch((e) => setError(e.message))
        loadItems().then(() => setLoading(false))
    }, [projectId, api])

    const capture = async () => {
        if (!draft.trim() || !projectId) return
        setBusy(true); setError(null)
        try {
            await api.items.create(projectId, { title: draft.trim(), type: "task", horizon: "inbox", clarityState: "idea" })
            setDraft(""); await loadItems()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const promote = async (item: WorkItem, horizon: string) => {
        setError(null)
        // sai da inbox: some da lista imediatamente
        setItems((prev) => prev.filter((i) => i.id !== item.id))
        try { await api.items.update(item.id, { horizon }) }
        catch (e: any) { setError(e.message); loadItems() }
    }

    const setClarity = async (item: WorkItem, clarityState: string) => {
        setError(null)
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, clarityState } : i))
        try { await api.items.update(item.id, { clarityState }) }
        catch (e: any) { setError(e.message); loadItems() }
    }

    const inspector = selected
        ? <WorkItemInspector itemId={selected} projectId={projectId} users={users}
            onClose={() => setSelected(null)} onChanged={loadItems} />
        : undefined

    // Referências a itens (CFGEC-26…) em qualquer texto desta tela abrem o inspector.
    return <ItemNavigatorProvider onOpenItem={setSelected}>
        <AppShell active="inbox" activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined} inspector={inspector}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Ideias" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Ideias · captura rápida e triagem"
            actions={<PageFeedbackButton scope="ideas" projectId={projectId} label="Todas as ideias" />}
            onInspectorClose={() => setSelected(null)}>

        <div className="mpm-card">
            <div className="mpm-row">
                <Icon name="lightbulb outline" size="large" />
                <input className="mpm-input" placeholder="Nova ideia... (Enter para capturar)"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") capture() }} />
                <button className="mpm-btn mpm-btn--primary" disabled={busy || !draft.trim()} onClick={capture}>
                    <Icon name="plus" /> Capturar
                </button>
            </div>
        </div>

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : items.length === 0
                ? <EmptyState icon="inbox" title="Nenhuma ideia capturada" hint="Digite acima para capturar sua primeira ideia." />
                : <div className="mpm-col mpm-gap-4">
                    {items.map((it) =>
                        <div key={it.id} className="mpm-card mpm-col">
                            <div className="mpm-row mpm-wrap">
                                <TypeBadge type={it.type} />
                                <ValueBadge value={it.value} />
                                <EffortBadge effort={it.effort} />
                                <AreaBadge area={it.area} />
                                <span className="mpm-mono mpm-muted">{it.key}</span>
                                <span style={{ fontWeight: 600, cursor: "pointer", flex: 1 }} onClick={() => setSelected(it.id)}>{it.title}</span>
                            </div>
                            <div className="mpm-row mpm-wrap">
                                <span className="mpm-field__label">Clareza</span>
                                <select className="mpm-inline-select" value={it.clarityState || "idea"}
                                    onChange={(e) => setClarity(it, e.target.value)}>
                                    {CLARITY_STATES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <span className="mpm-toolbar__spacer" />
                                <span className="mpm-field__label">Promover para</span>
                                {PROMOTE.map((p) =>
                                    <button key={p.key} className="mpm-btn mpm-btn--sm" title={`Mover para ${p.label}`}
                                        onClick={() => promote(it, p.key)}>
                                        <Icon name={p.icon} /> {p.label}
                                    </button>)}
                            </div>
                        </div>)}
                </div>}
        </AppShell>
    </ItemNavigatorProvider>
}

export default InboxPage
