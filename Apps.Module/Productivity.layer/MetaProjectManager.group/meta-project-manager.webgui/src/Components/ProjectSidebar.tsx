import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Project } from "../api/types"

interface ProjectSidebarProps {
    active: string                 // seção ativa: home | board | list | backlog | users | agents | reports
    activeProjectId?: string
}

const NAV: { key: string; label: string; icon: any; to: string }[] = [
    { key: "home",    label: "Projetos",    icon: "th large",  to: "/" },
    { key: "users",   label: "Usuários",    icon: "users",     to: "/users" },
    { key: "agents",  label: "Agentes",     icon: "microchip", to: "/agents" },
    { key: "reports", label: "Relatórios",  icon: "chart bar", to: "/reports" }
]

// ProjectSidebar (spec §11.1): navegação global + lista de projetos ativos.
const ProjectSidebar = ({ active, activeProjectId }: ProjectSidebarProps) => {
    const api = useApi()
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[]>([])

    useEffect(() => {
        let alive = true
        api.projects.list({})
            .then((list) => { if (alive) setProjects(list || []) })
            .catch(() => { if (alive) setProjects([]) })
        return () => { alive = false }
    }, [api])

    return <aside className="mpm-sidebar">
        <div>
            <div className="mpm-sidebar__section-title">Navegação</div>
            <nav className="mpm-nav">
                {NAV.map((n) =>
                    <a key={n.key}
                        className={`mpm-nav__item ${active === n.key ? "is-active" : ""}`}
                        onClick={() => navigate(n.to)}>
                        <Icon name={n.icon} /> {n.label}
                    </a>)}
            </nav>
        </div>

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
