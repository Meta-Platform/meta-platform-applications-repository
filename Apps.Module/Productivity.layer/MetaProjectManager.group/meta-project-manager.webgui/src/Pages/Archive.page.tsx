import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { Project } from "../api/types"
import AppShell from "../Components/AppShell"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { formatDateTime, initials, plainText } from "../Utils/format"

// Resumo do card (mesmo critério da Home): usa shortDescription; senão, um
// recorte visual da descrição.
const cardSummary = (p: Project): string => {
    if (p.shortDescription) return p.shortDescription
    if (!p.description) return "sem descrição"
    const text = plainText(p.description)
    return text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text
}

// ArchivePage: a ÁREA SEPARADA de projetos arquivados. Serve para consultar —
// clicar num card abre o projeto pelas telas normais, que se travam sozinhas em
// somente-leitura (status "archived"). Aqui (fora de rota de projeto) NÃO é
// read-only, então "Restaurar" funciona. É o único ponto para restaurar.
const ArchivePage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    const load = () => api.projects.list({ status: "archived", includeCounts: "1" })
        .then((l) => setProjects(l || []))
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [api])
    // Projetos arquivados/restaurados por agentes aparecem sem refresh.
    useLiveReload(load, { always: true })

    const restore = async (e: React.MouseEvent, p: Project) => {
        e.stopPropagation()
        setError(null); setRestoringId(p.id)
        try { await api.projects.restore(p.id); await load() }
        catch (err: any) { setError(err.message) }
        finally { setRestoringId(null) }
    }

    return <AppShell active="archive"
        breadcrumb={[{ label: "Arquivados" }]}
        title="Arquivados"
        subtitle="projetos congelados para consulta — navegação somente leitura">
        <div className="mpm-card mpm-archive-note">
            <Icon name="info circle" />
            <span>Projetos arquivados são <strong>somente leitura</strong>: você navega o projeto inteiro
                (board, lista, backlog, ideias, planejamento e itens), mas nada pode ser alterado.
                Para voltar a editar, restaure o projeto.</span>
        </div>

        <ErrorBanner error={error} />

        {projects === null
            ? <Loading />
            : projects.length === 0
                ? <EmptyState icon="archive" title="Nenhum projeto arquivado"
                    hint="Projetos que você arquivar aparecem aqui para consulta." />
                : <div className="mpm-grid-cards">
                    {projects.map((p) =>
                        <div key={p.id} className="mpm-card mpm-project-card mpm-project-card--archived"
                            title={`${p.shortDescription || p.name} — clique para consultar (somente leitura)`}
                            onClick={() => navigate(`/projects/${p.id}`)}>
                            <div className="mpm-project-card__head">
                                <span className="mpm-project-card__icon" style={p.color ? { background: p.color } : undefined}>
                                    {p.icon || initials(p.name)}
                                </span>
                                <div style={{ minWidth: 0 }}>
                                    <div className="mpm-project-card__name" title={p.name}>{p.name}</div>
                                    <div className="mpm-project-card__key">{p.keyPrefix} · {p.slug}</div>
                                </div>
                            </div>
                            <div className="mpm-project-card__desc">{cardSummary(p)}</div>
                            <div className="mpm-project-card__foot">
                                <span className="mpm-chip mpm-chip--neutral"><Icon name="archive" /> arquivado</span>
                                {p.archivedAt ? <span className="mpm-muted mpm-mono" style={{ fontSize: "11px" }}>{formatDateTime(p.archivedAt)}</span> : null}
                                <span style={{ flex: 1 }} />
                                <button className="mpm-btn mpm-btn--sm" title="Restaurar este projeto (volta a ser editável)"
                                    disabled={restoringId === p.id}
                                    onClick={(e) => restore(e, p)}>
                                    <Icon name="undo" /> {restoringId === p.id ? "Restaurando…" : "Restaurar"}
                                </button>
                            </div>
                        </div>)}
                </div>}
    </AppShell>
}

export default ArchivePage
