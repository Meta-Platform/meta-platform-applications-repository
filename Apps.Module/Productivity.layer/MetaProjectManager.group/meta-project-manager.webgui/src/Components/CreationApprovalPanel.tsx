import * as React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import usePendingCreations from "../Hooks/usePendingCreations"
import { CreationRequest } from "../api/types"
import CreationRequestCard from "./CreationRequestCard"
import ConfirmActionModal from "./ConfirmActionModal"
import { Loading, ErrorBanner } from "./Primitives"

// CreationApprovalPanel: seção "Pedidos de criação" — humano aprova/rejeita os
// pedidos de projeto/board bloqueados de agentes. Realtime via usePendingCreations.
const CreationApprovalPanel = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { requests, loading, reload } = usePendingCreations()
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [rejectTarget, setRejectTarget] = useState<CreationRequest | null>(null)

    const approve = async (req: CreationRequest) => {
        setBusyId(req.id); setError(null)
        try {
            const { result } = await api.agents.approveCreation(req.id)
            await reload()
            // navega para o que foi criado
            if (result && result.id) {
                if (req.type === "board") {
                    const projectId = result.projectId || req.projectId
                    navigate(projectId ? `/projects/${projectId}/board/${result.id}` : `/projects/${result.id}`)
                } else {
                    navigate(`/projects/${result.id}`)
                }
            }
        } catch (e: any) { setError(e.message) } finally { setBusyId(null) }
    }

    // DECIDIR EM BLOCO (MPMX3-8): quando o agente pede N mudanças de status, o
    // custo do gate crescia linearmente e o humano passava a carimbar — o oposto
    // do que ele existe para garantir. Aqui a decisão é uma, sobre a lista que
    // está na tela; cada pedido é processado de forma independente no servidor,
    // então um obsoleto não derruba os outros.
    const decideAll = async (decision: "approve" | "reject") => {
        setBusyId("all"); setError(null)
        try {
            const out = await api.agents.decideCreations(requests.map((r) => r.id), decision)
            await reload()
            if (out.failed > 0) {
                const first = out.results.find((r) => !r.ok)
                setError(`${out.succeeded} de ${out.total} decidido(s). ${out.failed} falhou/falharam — ex.: ${first?.error?.message || first?.error?.code}`)
            }
        } catch (e: any) { setError(e.message) } finally { setBusyId(null) }
    }

    const doReject = async () => {
        if (!rejectTarget) return
        const req = rejectTarget
        setBusyId(req.id); setError(null)
        try { await api.agents.rejectCreation(req.id); await reload(); setRejectTarget(null) }
        catch (e: any) { setError(e.message) } finally { setBusyId(null) }
    }

    if (loading && requests.length === 0) return <Loading text="carregando pedidos..." />
    if (requests.length === 0) return null

    return <div className="mpm-panel" style={{ borderColor: "var(--mp-warning)" }}>
        <div className="mpm-panel__title">
            <Icon name="shield" /> Pedidos de criação
            <span className="mpm-chip mpm-chip--warning" style={{ marginLeft: "8px" }}>{requests.length}</span>
        </div>
        <div className="mpm-page-subtitle" style={{ marginBottom: "var(--mp-space-3)" }}>
            Agentes não criam projetos/boards diretamente — aprove para executar a criação ou rejeite.
        </div>
        {requests.length > 1
            ? <div className="mpm-toolbar mpm-toolbar--end" style={{ marginBottom: "var(--mp-space-3)" }}>
                <span className="mpm-muted" style={{ fontSize: "12px", flex: 1 }}>
                    {requests.length} pedidos na fila — decida de uma vez se já autorizou o conjunto.
                </span>
                <button className="mpm-btn mpm-btn--sm mpm-btn--danger" disabled={busyId === "all"} onClick={() => decideAll("reject")}>
                    <Icon name="ban" /> Rejeitar todos
                </button>
                <button className="mpm-btn mpm-btn--sm mpm-btn--primary" disabled={busyId === "all"} onClick={() => decideAll("approve")}>
                    <Icon name="check circle" /> Aprovar todos ({requests.length})
                </button>
            </div>
            : null}
        <ErrorBanner error={error} />
        <div className="mpm-col mpm-gap-4">
            {requests.map((req) =>
                <CreationRequestCard key={req.id}
                    request={req}
                    busy={busyId === req.id}
                    onApprove={() => approve(req)}
                    onReject={() => setRejectTarget(req)} />)}
        </div>

        {rejectTarget
            ? <ConfirmActionModal
                title="Rejeitar pedido"
                danger
                message={<>Rejeitar este pedido do agente? Nada será criado/removido.</>}
                confirmLabel="Rejeitar"
                busy={busyId === rejectTarget.id}
                error={error}
                onConfirm={doReject}
                onCancel={() => setRejectTarget(null)} />
            : null}
    </div>
}

export default CreationApprovalPanel
