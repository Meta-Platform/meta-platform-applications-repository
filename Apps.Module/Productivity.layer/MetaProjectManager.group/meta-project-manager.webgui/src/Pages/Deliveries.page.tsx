import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { Delivery, Project } from "../api/types"
import AppShell from "../Components/AppShell"
import { QualityBadge } from "./ReviewDesk.page"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"

// O HISTÓRICO de entregas do projeto, por rodada. Serve à pergunta "quantas
// vezes isto voltou, e por quê" — que o board nunca soube responder.
const STATUS_LABEL: Record<string, string> = {
    draft: "rascunho", collecting: "colhendo evidência", "ai-review": "com o revisor-IA",
    "awaiting-human": "aguardando você", accepted: "aceita", returned: "devolvida", withdrawn: "retirada"
}

const DeliveriesPage = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { projectId } = useParams<{ projectId: string }>()
    const [deliveries, setDeliveries] = useState<Delivery[]>([])
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return Promise.all([api.deliveries.list(projectId, { limit: 200 }), api.projects.get(projectId)])
            .then(([ds, p]) => { setDeliveries(ds); setProject(p); setError(null) })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [api, projectId])

    useEffect(() => { load() }, [load])
    useLiveReload(load)

    if (loading) return <AppShell active="deliveries" title="Entregas"><Loading /></AppShell>

    return (
        <AppShell
            active="deliveries"
            activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined}
            breadcrumb={[{ label: project ? project.name : "Projeto", to: `/projects/${projectId}` }, { label: "Entregas" }]}
            title="Entregas"
            subtitle={`${deliveries.length} entrega(s) — cada devolução abre uma rodada nova`}
        >
            {error ? <ErrorBanner error={error} /> : null}
            {!deliveries.length
                ? <EmptyState title="Nenhuma entrega ainda neste projeto." />
                : (
                    <ul className="mpm-desk-list">
                        {deliveries.map((d) => (
                            <li key={d.id} className="mpm-desk-row" onClick={() => navigate(`/deliveries/${d.id}`)}>
                                <div className="mpm-desk-row-main">
                                    <code>{d.key}</code>
                                    <strong>{d.title}</strong>
                                </div>
                                <div className="mpm-desk-row-meta">
                                    <QualityBadge quality={d.evidenceQuality} />
                                    <span className="mpm-chip">{STATUS_LABEL[d.status] || d.status}</span>
                                    {d.returnReason ? <span className="mpm-muted" title={d.returnReason}>devolvida: {d.returnReason.slice(0, 60)}</span> : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
        </AppShell>
    )
}

export default DeliveriesPage
