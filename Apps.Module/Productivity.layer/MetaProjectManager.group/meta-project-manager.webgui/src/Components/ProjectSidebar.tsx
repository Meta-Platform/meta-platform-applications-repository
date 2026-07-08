import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import usePendingCreations from "../Hooks/usePendingCreations"
import { Project } from "../api/types"

interface ProjectSidebarProps {
    active: string                 // seção ativa: home | board | list | backlog | users | agents | reports
    activeProjectId?: string
}

const NAV: { key: string; label: string; icon: any; to: string }[] = [
    { key: "home",    label: "Projetos",    icon: "th large",  to: "/" },
    { key: "users",   label: "Usuários",    icon: "users",     to: "/users" },
    { key: "agents",  label: "Agentes",     icon: "microchip", to: "/agents" },
    { key: "reports", label: "Relatórios",  icon: "chart bar", to: "/reports" },
    { key: "guide",   label: "Guia de IA",  icon: "book",      to: "/guide" }
]

// Sub-navegação do projeto atual (aparece quando há projeto ativo).
const PROJECT_NAV: { key: string; label: string; icon: any; path: (id: string) => string }[] = [
    { key: "overview", label: "Visão geral", icon: "home",    path: (id) => `/projects/${id}` },
    { key: "board",    label: "Board",       icon: "columns", path: (id) => `/projects/${id}/board` },
    { key: "list",     label: "Lista",       icon: "list",    path: (id) => `/projects/${id}/list` },
    { key: "backlog",  label: "Backlog",     icon: "clipboard list", path: (id) => `/projects/${id}/backlog` },
    { key: "inbox",    label: "Inbox",       icon: "inbox",   path: (id) => `/projects/${id}/inbox` },
    { key: "roadmap",  label: "Roadmap",     icon: "road",    path: (id) => `/projects/${id}/roadmap` }
]

// ProjectSidebar (spec §11.1): navegação global + projeto atual + lista de projetos.
const ProjectSidebar = ({ active, activeProjectId }: ProjectSidebarProps) => {
    const api = useApi()
    const navigate = useNavigate()
    const { count: pendingCreations } = usePendingCreations()
    const [projects, setProjects] = useState<Project[]>([])
    const [inboxCount, setInboxCount] = useState(0)

    useEffect(() => {
        let alive = true
        api.projects.list({})
            .then((list) => { if (alive) setProjects(list || []) })
            .catch(() => { if (alive) setProjects([]) })
        return () => { alive = false }
    }, [api])

    useEffect(() => {
        if (!activeProjectId) { setInboxCount(0); return }
        let alive = true
        api.items.list(activeProjectId, { horizon: "inbox" })
            .then((l) => { if (alive) setInboxCount((l || []).length) })
            .catch(() => { if (alive) setInboxCount(0) })
        return () => { alive = false }
    }, [activeProjectId, api, active])

    return <aside className="mpm-sidebar">
        <div>
            <div className="mpm-sidebar__section-title">Navegação</div>
            <nav className="mpm-nav">
                {NAV.map((n) =>
                    <a key={n.key}
                        className={`mpm-nav__item ${active === n.key ? "is-active" : ""}`}
                        onClick={() => navigate(n.to)}>
                        <Icon name={n.icon} /> <span style={{ flex: 1 }}>{n.label}</span>
                        {n.key === "agents" && pendingCreations > 0
                            ? <span className="mpm-chip mpm-chip--warning" title="pedidos de criação pendentes">{pendingCreations}</span>
                            : null}
                    </a>)}
            </nav>
        </div>

        {activeProjectId
            ? <div>
                <div className="mpm-sidebar__section-title">Projeto atual</div>
                <nav className="mpm-nav">
                    {PROJECT_NAV.map((n) =>
                        <a key={n.key}
                            className={`mpm-nav__item ${active === n.key ? "is-active" : ""}`}
                            onClick={() => navigate(n.path(activeProjectId))}>
                            <Icon name={n.icon} /> <span style={{ flex: 1 }}>{n.label}</span>
                            {n.key === "inbox" && inboxCount > 0
                                ? <span className="mpm-chip mpm-chip--info" title="ideias na inbox">{inboxCount}</span>
                                : null}
                        </a>)}
                </nav>
            </div>
            : null}

        <div>
            <div className="mpm-sidebar__section-title">Projetos</div>
            <div className="mpm-proj-list">
                {projects.length === 0
                    ? <div className="mpm-muted" style={{ padding: "0 12px", fontSize: "12px" }}>nenhum projeto</div>
                    : projects.map((p) =>
                        <div key={p.id}
                            className={`mpm-proj-list__item ${activeProjectId === p.id ? "is-active" : ""}`}
                            title={p.name}
                            onClick={() => navigate(`/projects/${p.id}`)}>
                            <span className="mpm-proj-dot" style={p.color ? { background: p.color } : undefined} />
                            <span className="mpm-proj-list__name">{p.name}</span>
                        </div>)}
            </div>
        </div>
    </aside>
}

export default ProjectSidebar
