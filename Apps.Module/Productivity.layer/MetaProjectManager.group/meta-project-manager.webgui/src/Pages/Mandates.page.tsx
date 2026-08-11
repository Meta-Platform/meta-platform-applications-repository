import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "@i-components"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { AgentMandate, Project } from "../api/types"
import AppShell from "../Components/AppShell"
import { Loading, EmptyState, ErrorBanner, Modal } from "../Components/Primitives"

/**
 * MANDATOS — onde o humano concede escopo e vê quanto falta para o agente parar.
 *
 * O contador que mais importa não é o de erro do agente: é o de entregas sem
 * revisão. Ele mede o quanto o HUMANO virou o gargalo, e é a condição de parada
 * mais comum na prática.
 */
const STOP_LABEL: Record<string, string> = {
    "unreviewed-limit": "entregas demais esperando você",
    "consecutive-returns": "devoluções seguidas",
    "out-of-scope": "saiu do escopo",
    "delivery-limit": "teto de entregas",
    expired: "validade vencida",
    revoked: "revogado por você"
}

const MandatesPage = () => {
    const api = useApi()
    const { projectId } = useParams<{ projectId: string }>()
    const [mandates, setMandates] = useState<AgentMandate[]>([])
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [criando, setCriando] = useState(false)
    const [form, setForm] = useState({ title: "", maxUnreviewedDeliveries: 3, maxConsecutiveReturns: 2 })

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return Promise.all([api.mandates.list(projectId), api.projects.get(projectId)])
            .then(([ms, p]) => { setMandates(ms); setProject(p); setError(null) })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false))
    }, [api, projectId])

    useEffect(() => { load() }, [load])
    useLiveReload(load)

    const criar = async () => {
        if (!projectId || !form.title.trim()) return
        try {
            await api.mandates.create(projectId, { title: form.title.trim(), maxUnreviewedDeliveries: form.maxUnreviewedDeliveries, maxConsecutiveReturns: form.maxConsecutiveReturns })
            setCriando(false); setForm({ title: "", maxUnreviewedDeliveries: 3, maxConsecutiveReturns: 2 })
            await load()
        } catch (e: any) { setError(e.message) }
    }

    const revogar = async (m: AgentMandate) => {
        try { await api.mandates.revoke(m.id, "revogado na interface"); await load() }
        catch (e: any) { setError(e.message) }
    }

    const estender = async (m: AgentMandate) => {
        try { await api.mandates.extend(m.id, { maxUnreviewedDeliveries: (m.maxUnreviewedDeliveries || 3) + 3 }); await load() }
        catch (e: any) { setError(e.message) }
    }

    if (loading) return <AppShell active="mandates" title="Mandatos"><Loading /></AppShell>

    return (
        <AppShell
            active="mandates"
            activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined}
            breadcrumb={[{ label: project ? project.name : "Projeto", to: `/projects/${projectId}` }, { label: "Mandatos" }]}
            title="Mandatos"
            subtitle="Até onde o agente anda sozinho, e o que o faz parar"
            actions={<button className="mpm-btn mpm-btn--primary" onClick={() => setCriando(true)}><Icon name="plus" /> Novo mandato</button>}
        >
            {error ? <ErrorBanner error={error} /> : null}
            {!mandates.length
                ? <EmptyState title="Nenhum mandato. Sem mandato, o agente trabalha sem limite de escopo." />
                : (
                    <div className="mpm-mandate-list">
                        {mandates.map((m) => (
                            <div key={m.id} className={`mpm-mandate-card mpm-mandate-card--${m.status}`}>
                                <div className="mpm-mandate-head">
                                    <strong>{m.title}</strong>
                                    <span className="mpm-chip">{m.status}</span>
                                    {m.stopReason ? <span className="mpm-chip" style={{ background: "#f97316", color: "#fff" }}>{STOP_LABEL[m.stopReason] || m.stopReason}</span> : null}
                                </div>
                                {m.shortDescription ? <p className="mpm-muted">{m.shortDescription}</p> : null}
                                <div className="mpm-mandate-counters">
                                    <Gauge label="entregas feitas" value={m.deliveriesMade || 0} max={m.maxDeliveries} />
                                    <Gauge label="sem revisão" value={m.deliveriesUnreviewed || 0} max={m.maxUnreviewedDeliveries} alerta />
                                    <Gauge label="devoluções seguidas" value={m.consecutiveReturns || 0} max={m.maxConsecutiveReturns} alerta />
                                    <Gauge label="itens concluídos" value={m.itemsCompleted || 0} max={m.maxItems} />
                                </div>
                                <div className="mpm-mandate-actions">
                                    {m.status === "exhausted"
                                        ? <button className="mpm-btn" onClick={() => estender(m)}><Icon name="play" /> Deixar continuar</button>
                                        : null}
                                    {m.status !== "revoked"
                                        ? <button className="mpm-btn mpm-btn--danger" onClick={() => revogar(m)}><Icon name="stop" /> Revogar</button>
                                        : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

            {criando ? (
                <Modal title="Novo mandato" onClose={() => setCriando(false)}>
                    <label>Título</label>
                    <input value={form.title} autoFocus onChange={(e) => setForm({ ...form, title: e.target.value })}
                           placeholder="Ex.: Rodada 3 — coleta de evidência" />
                    <label>Parar depois de quantas entregas sem revisão</label>
                    <input type="number" min={1} value={form.maxUnreviewedDeliveries}
                           onChange={(e) => setForm({ ...form, maxUnreviewedDeliveries: Number(e.target.value) })} />
                    <p className="mpm-muted">É o limite que protege VOCÊ: passou disso, o agente para de acumular trabalho que ninguém olhou.</p>
                    <label>Parar depois de quantas devoluções seguidas</label>
                    <input type="number" min={1} value={form.maxConsecutiveReturns}
                           onChange={(e) => setForm({ ...form, maxConsecutiveReturns: Number(e.target.value) })} />
                    <div className="mpm-delivery-actions">
                        <button className="mpm-btn mpm-btn--primary" onClick={criar} disabled={!form.title.trim()}>Conceder</button>
                        <button className="mpm-btn" onClick={() => setCriando(false)}>Cancelar</button>
                    </div>
                </Modal>
            ) : null}
        </AppShell>
    )
}

const Gauge = ({ label, value, max, alerta }: { label: string; value: number; max?: number; alerta?: boolean }) => {
    const perto = alerta && max ? value >= max : false
    return (
        <div className="mpm-mandate-gauge">
            <span className="mpm-mandate-gauge-n" style={perto ? { color: "#dc2626" } : undefined}>
                {value}{max ? `/${max}` : ""}
            </span>
            <span className="mpm-mandate-gauge-label">{label}</span>
        </div>
    )
}

export default MandatesPage
