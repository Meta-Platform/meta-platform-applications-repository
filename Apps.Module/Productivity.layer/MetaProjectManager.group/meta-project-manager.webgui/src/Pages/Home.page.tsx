import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Project } from "../api/types"
import AppShell from "../Components/AppShell"
import NewProjectModal from "../Components/NewProjectModal"
import { StatusChip, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { initials } from "../Utils/format"

const STATUS_FILTERS = ["all", "planning", "candidate", "active", "on-hold", "completed", "archived"]

// HomePage (spec §11): grade de projetos com filtro por status.
const HomePage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[] | null>(null)
    const [filter, setFilter] = useState("all")
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [importing, setImporting] = useState(false)

    const load = () => api.projects.list({})
        .then((l) => setProjects(l || []))
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [api])

    // Feature 6: importar projeto de um arquivo .json exportado.
    const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0]
        e.target.value = ""
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
            setError(null); setImporting(true)
            try {
                const data = JSON.parse(String(reader.result || "{}"))
                const result = await api.system.importProject(data)
                await load()
                if (result && result.id) navigate(`/projects/${result.id}`)
            } catch (err: any) { setError(err.message || "arquivo inválido") }
            finally { setImporting(false) }
        }
        reader.readAsText(file)
    }

    const shown = (projects || []).filter((p) => filter === "all" || p.status === filter)

    return <AppShell active="home" onCreateProject={() => setCreating(true)}>
        <div className="mpm-page-head">
            <div className="mpm-page-head__titles">
                <h1 className="mpm-page-title">Projetos</h1>
                <div className="mpm-page-subtitle">gerencie iniciativas, boards e work items</div>
            </div>
            <div className="mpm-page-head__actions">
                <label className="mpm-btn" style={{ cursor: "pointer" }} title="Importar projeto (.json)">
                    <Icon name="upload" /> {importing ? "Importando..." : "Importar"}
                    <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={onImportFile} disabled={importing} />
                </label>
                <button className="mpm-btn mpm-btn--primary" onClick={() => setCreating(true)}><Icon name="plus" /> Novo Projeto</button>
            </div>
        </div>

        <div className="mpm-toolbar">
            {STATUS_FILTERS.map((s) =>
                <button key={s}
                    className={`mpm-btn mpm-btn--sm ${filter === s ? "mpm-btn--primary" : "mpm-btn--ghost"}`}
                    onClick={() => setFilter(s)}>{s === "all" ? "Todos" : s}</button>)}
        </div>

        <ErrorBanner error={error} />

        {projects === null
            ? <Loading />
            : shown.length === 0
                ? <EmptyState icon="folder open outline" title="Nenhum projeto"
                    hint="Crie seu primeiro projeto para começar."
                    action={<button className="mpm-btn mpm-btn--primary" onClick={() => setCreating(true)}><Icon name="plus" /> Novo Projeto</button>} />
                : <div className="mpm-grid-cards">
                    {shown.map((p) =>
                        <div key={p.id} className="mpm-card mpm-project-card" onClick={() => navigate(`/projects/${p.id}`)}>
                            <div className="mpm-project-card__head">
                                <span className="mpm-project-card__icon" style={p.color ? { background: p.color } : undefined}>
                                    {p.icon || initials(p.name)}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                    <div className="mpm-project-card__name">{p.name}</div>
                                    <div className="mpm-project-card__key">{p.keyPrefix}</div>
                                </div>
                            </div>
                            <div className="mpm-project-card__desc">{p.description || "sem descrição"}</div>
                            <div className="mpm-row"><StatusChip status={p.status} /></div>
                        </div>)}
                </div>}

        {creating
            ? <NewProjectModal onClose={() => setCreating(false)}
                onCreated={(p) => { setCreating(false); navigate(`/projects/${p.id}`) }} />
            : null}
    </AppShell>
}

export default HomePage
