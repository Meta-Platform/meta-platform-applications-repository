import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { Project } from "../api/types"
import ProjectSwitcher from "./ProjectSwitcher"

// Sub-navegação do projeto atual. `hint` = tooltip.
const PROJECT_NAV: { key: string; label: string; icon: any; path: (id: string) => string; hint: string }[] = [
    { key: "overview", label: "Visão geral", icon: "home",    path: (id) => `/projects/${id}`,         hint: "Resumo do projeto: progresso, boards e atividade recente." },
    { key: "board",    label: "Board",       icon: "columns", path: (id) => `/projects/${id}/board`,   hint: "Quadro Kanban: colunas de status por onde o trabalho flui." },
    { key: "list",     label: "Lista",       icon: "list",    path: (id) => `/projects/${id}/list`,    hint: "Lista hierárquica dos itens, com filtros e agrupamento." },
    { key: "backlog",  label: "Backlog",     icon: "clipboard list", path: (id) => `/projects/${id}/backlog`, hint: "Trabalho priorizado ainda não em execução (valor/esforço/clareza)." },
    { key: "inbox",    label: "Ideias",      icon: "inbox",   path: (id) => `/projects/${id}/inbox`,   hint: "Ideias cruas anotadas rápido, para triar depois (inbox, no jargão técnico)." },
    { key: "roadmap",  label: "Planejamento", icon: "road",   path: (id) => `/projects/${id}/roadmap`, hint: "O plano no tempo: entregas (por data) e horizontes (agora/próximo/depois)." },
    { key: "feedback", label: "Feedback",   icon: "comment alternate outline", path: (id) => `/projects/${id}/feedback`, hint: "Feedbacks que você deu aos agentes neste projeto." }
]

interface ProjectColumnProps {
    active: string
    activeProjectId?: string
    onCreateProject?: () => void
}

// Coluna do PROJETO ATUAL: seletor de projeto no topo (em destaque) e, logo
// abaixo, o menu das telas daquele projeto. A navegação global mora no NavRail.
const ProjectColumn = ({ active, activeProjectId, onCreateProject }: ProjectColumnProps) => {
    const api = useApi()
    const navigate = useNavigate()
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

    // O badge de Ideias e a lista do seletor acompanham o que os agentes fazem.
    useLiveReload(() => {
        api.projects.list({}).then((l) => setProjects(l || [])).catch(() => {})
        if (activeProjectId)
            api.items.list(activeProjectId, { horizon: "inbox" })
                .then((l) => setInboxCount((l || []).length)).catch(() => {})
    }, { always: true })

    return <aside className="mpm-projcol">
        <ProjectSwitcher projects={projects} activeProjectId={activeProjectId} onCreateProject={onCreateProject} />

        {activeProjectId
            ? <nav className="mpm-nav">
                {PROJECT_NAV.map((n) =>
                    <a key={n.key}
                        className={`mpm-nav__item ${active === n.key ? "is-active" : ""}`}
                        title={n.hint}
                        onClick={() => navigate(n.path(activeProjectId))}>
                        <Icon name={n.icon} />
                        <span style={{ flex: 1 }}>{n.label}</span>
                        {n.key === "inbox" && inboxCount > 0
                            ? <span className="mpm-chip mpm-chip--info" title="ideias a triar">{inboxCount}</span>
                            : null}
                    </a>)}
            </nav>
            : <div className="mpm-projcol__empty">
                <Icon name="folder open outline" size="large" />
                <div>Escolha um projeto acima para ver board, lista, backlog e planejamento.</div>
            </div>}
    </aside>
}

export default ProjectColumn
