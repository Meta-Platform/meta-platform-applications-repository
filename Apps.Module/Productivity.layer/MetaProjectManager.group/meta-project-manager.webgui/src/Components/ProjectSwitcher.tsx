import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import { Project } from "../api/types"

interface ProjectSwitcherProps {
    projects: Project[]
    activeProjectId?: string
    onCreateProject?: () => void
}

// Seletor do projeto atual (topo da coluna do projeto): mostra key + nome do
// projeto aberto e abre a lista para trocar. Substitui a lista sempre-visível,
// que empurrava o menu do projeto para o fim da sidebar.
const ProjectSwitcher = ({ projects, activeProjectId, onCreateProject }: ProjectSwitcherProps) => {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [filter, setFilter] = useState("")
    const ref = useRef<HTMLDivElement>(null)

    const active = projects.filter((p) => p.id === activeProjectId)[0]

    // Fecha ao clicar fora ou apertar Esc.
    useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
        window.addEventListener("mousedown", onDown)
        window.addEventListener("keydown", onKey)
        return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey) }
    }, [open])

    useEffect(() => { if (!open) setFilter("") }, [open])

    const pick = (p: Project) => { setOpen(false); navigate(`/projects/${p.id}`) }

    const needle = filter.trim().toLowerCase()
    const visible = needle
        ? projects.filter((p) => (p.name + " " + (p.keyPrefix || "")).toLowerCase().indexOf(needle) >= 0)
        : projects

    return <div className="mpm-projswitch" ref={ref}>
        <button className={`mpm-projswitch__btn ${open ? "is-open" : ""}`}
            title={active ? `Projeto atual: ${active.name} — clique para trocar` : "Escolher projeto"}
            onClick={() => setOpen((v) => !v)}>
            <span className="mpm-proj-dot" style={active && active.color ? { background: active.color } : undefined} />
            <span className="mpm-projswitch__key">{active && active.keyPrefix ? active.keyPrefix : "—"}</span>
            <Icon name="chevron down" className="mpm-muted" />
            <span className="mpm-projswitch__name">{active ? active.name : "nenhum projeto"}</span>
        </button>

        {open
            ? <div className="mpm-projswitch__menu">
                <div className="mpm-projswitch__search">
                    <Icon name="search" className="mpm-muted" />
                    <input autoFocus placeholder="filtrar projetos…" value={filter}
                        onChange={(e) => setFilter(e.target.value)} />
                </div>
                <div className="mpm-projswitch__list">
                    {visible.length === 0
                        ? <div className="mpm-muted" style={{ padding: "var(--mp-space-2) var(--mp-space-3)", fontSize: "12px" }}>
                            nenhum projeto
                        </div>
                        : visible.map((p) =>
                            <div key={p.id}
                                className={`mpm-projswitch__item ${p.id === activeProjectId ? "is-active" : ""}`}
                                title={p.name}
                                onClick={() => pick(p)}>
                                <span className="mpm-proj-dot" style={p.color ? { background: p.color } : undefined} />
                                <span className="mpm-mono mpm-muted">{p.keyPrefix || ""}</span>
                                <span className="mpm-projswitch__itemname">{p.name}</span>
                                {p.id === activeProjectId ? <Icon name="check" className="mpm-muted" /> : null}
                            </div>)}
                </div>
                {onCreateProject
                    ? <button className="mpm-projswitch__new" onClick={() => { setOpen(false); onCreateProject() }}>
                        <Icon name="plus" /> Novo projeto
                    </button>
                    : null}
            </div>
            : null}
    </div>
}

export default ProjectSwitcher
