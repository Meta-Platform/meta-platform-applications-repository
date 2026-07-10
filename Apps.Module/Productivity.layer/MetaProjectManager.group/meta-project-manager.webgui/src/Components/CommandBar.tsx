import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useItemNavigator from "../Hooks/useItemNavigator"
import { Project, WorkItem } from "../api/types"

interface Command {
    id: string
    label: string
    icon: any
    // Legenda secundária (ex.: shortDescription do projeto) — também entra na busca.
    hint?: string
    // Termos extras para casar na busca (key, slug…).
    keywords?: string
    run: () => void
}

interface CommandBarProps {
    onClose: () => void
    activeProjectId?: string
    onCreateProject?: () => void
}

// CommandBar (Ctrl+K): ações rápidas — criar projeto, ir para projeto,
// abrir relatórios/usuários/agentes. Renderizada pelo AppShell.
const CommandBar = ({ onClose, activeProjectId, onCreateProject }: CommandBarProps) => {
    const api = useApi()
    const navigate = useNavigate()
    const nav = useItemNavigator()
    const [query, setQuery] = useState("")
    const [projects, setProjects] = useState<Project[]>([])
    const [items, setItems] = useState<WorkItem[]>([])
    const [cursor, setCursor] = useState(0)

    useEffect(() => {
        api.projects.list({}).then((l) => setProjects(l || [])).catch(() => setProjects([]))
    }, [api])

    // Itens vêm do servidor (são milhares): busca por título OU key, com debounce.
    // Digitar "MPMB-39" tem de achar aquele item, esteja em que projeto estiver.
    useEffect(() => {
        const text = query.trim()
        if (text.length < 2) { setItems([]); return }
        let alive = true
        const timer = setTimeout(() => {
            api.items.search(text, undefined, 15)
                .then((l) => { if (alive) setItems(l || []) })
                .catch(() => { if (alive) setItems([]) })
        }, 180)
        return () => { alive = false; clearTimeout(timer) }
    }, [query, api])

    // Abre o item onde o usuário está (o inspector da tela atual). Sem inspector
    // por perto, cai no board do projeto do item.
    const openItem = (item: WorkItem) => {
        onClose()
        if (nav) nav.openItem(item.id)
        else navigate(`/projects/${item.projectId}/board`)
    }

    const commands: Command[] = useMemo(() => {
        const list: Command[] = [
            { id: "new-project", label: "Novo projeto", icon: "plus", run: () => { onClose(); onCreateProject && onCreateProject() } },
            { id: "go-projects", label: "Ir para Projetos", icon: "th large", run: () => { onClose(); navigate("/") } },
            { id: "go-users", label: "Ir para Usuários", icon: "users", run: () => { onClose(); navigate("/users") } },
            { id: "go-agents", label: "Ir para Agentes", icon: "microchip", run: () => { onClose(); navigate("/agents") } },
            { id: "go-reports", label: "Ir para Relatórios", icon: "chart bar", run: () => { onClose(); navigate("/reports") } },
            { id: "go-audit", label: "Ir para Auditoria", icon: "history", run: () => { onClose(); navigate("/audit") } },
            { id: "go-guide", label: "Ir para Guia de IA", icon: "book", run: () => { onClose(); navigate("/guide") } },
            { id: "go-glossary", label: "Ir para Manual & Glossário", icon: "help circle", run: () => { onClose(); navigate("/glossary") } }
        ]
        if (activeProjectId)
            list.push({ id: "new-item", label: "Nova tarefa no projeto atual", icon: "tasks",
                run: () => { onClose(); navigate(`/projects/${activeProjectId}/backlog`) } })
        projects.forEach((p) =>
            list.push({
                id: `proj-${p.id}`, label: `Projeto: ${p.name}`, icon: "folder open",
                hint: p.shortDescription,
                keywords: `${p.keyPrefix} ${p.slug} ${p.shortDescription || ""}`,
                run: () => { onClose(); navigate(`/projects/${p.id}`) }
            }))
        list.push({ id: "audit-project", label: "Ver auditoria deste projeto", icon: "history",
            run: () => { onClose(); navigate(activeProjectId ? `/audit?project=${activeProjectId}` : "/audit") } })
        return list
    }, [projects, activeProjectId, navigate, onClose, onCreateProject])

    // Busca por rótulo, descrição curta, key e slug — e pelos itens vindos do
    // servidor, que aparecem primeiro quando a busca casa uma key exata.
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const itemCommands: Command[] = items.map((it) => ({
            id: `item-${it.id}`,
            label: `${it.key} — ${it.title}`,
            icon: "tasks",
            hint: it.statusKey,
            keywords: it.key,
            run: () => openItem(it)
        }))
        if (!q) return commands
        const matched = commands.filter((c) =>
            `${c.label} ${c.hint || ""} ${c.keywords || ""}`.toLowerCase().indexOf(q) >= 0)
        // Key exata ("MPMB-39") vem no topo; o resto segue a ordem natural.
        const exact = itemCommands.filter((c) => (c.keywords || "").toLowerCase() === q)
        const rest = itemCommands.filter((c) => (c.keywords || "").toLowerCase() !== q)
        return [...exact, ...rest, ...matched]
    }, [commands, query, items])

    useEffect(() => { setCursor(0) }, [query])

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)) }
        else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
        else if (e.key === "Enter") { e.preventDefault(); const cmd = filtered[cursor]; if (cmd) cmd.run() }
        else if (e.key === "Escape") { onClose() }
    }

    return <div className="mpm-overlay mpm-cmd" onClick={onClose}>
        <div className="mpm-modal" onClick={(e) => e.stopPropagation()}>
            <input
                autoFocus
                className="mpm-cmd__input"
                placeholder="Buscar comandos, projetos, itens ou agentes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown} />
            <div className="mpm-cmd__list">
                {filtered.length === 0
                    ? <div className="mpm-cmd__item mpm-muted">nenhum resultado</div>
                    : filtered.map((c, i) =>
                        <div key={c.id}
                            className={`mpm-cmd__item ${i === cursor ? "is-active" : ""}`}
                            onMouseEnter={() => setCursor(i)}
                            onClick={c.run}>
                            <Icon name={c.icon} />
                            <span className="mpm-cmd__label">
                                {c.label}
                                {c.hint ? <span className="mpm-cmd__hint">{c.hint}</span> : null}
                            </span>
                        </div>)}
            </div>
        </div>
    </div>
}

export default CommandBar
