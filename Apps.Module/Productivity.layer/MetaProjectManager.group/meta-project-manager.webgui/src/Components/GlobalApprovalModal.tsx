import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import usePendingCreations from "../Hooks/usePendingCreations"
import { CreationRequest } from "../api/types"
import Markdown from "./Markdown"
import { ErrorBanner } from "./Primitives"
import { formatDateTime } from "../Utils/format"

// Rótulos legíveis por tipo de alvo.
const TYPE_LABEL: Record<string, string> = {
    project: "projeto", board: "board", milestone: "milestone", sprint: "sprint", item: "item"
}
const COUNT_LABEL: Record<string, string> = {
    boards: "boards", items: "itens", attachments: "anexos", comments: "comentários", children: "subitens"
}

const kv = (label: string, value?: React.ReactNode) =>
    (value === undefined || value === null || value === "")
        ? null
        : <div className="mpm-field">
            <span className="mpm-field__label">{label}</span>
            <div className="mpm-mono" style={{ fontSize: "12px", wordBreak: "break-all" }}>{value}</div>
        </div>

// GlobalApprovalModal (spec §6/P0.3): montado no AppShell, aparece SOBRE qualquer
// tela quando há pedidos de agente pendentes (criação OU remoção). Mostra O QUE
// será feito/afetado e QUEM pediu, com aprovar/rejeitar (com motivo). Fila 1 de N.
const GlobalApprovalModal = () => {
    const api = useApi()
    const navigate = useNavigate()
    const { requests, reload } = usePendingCreations()
    const [index, setIndex] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState(false)
    const [reason, setReason] = useState("")

    // Mantém o índice dentro dos limites quando a fila muda.
    useEffect(() => {
        if (index >= requests.length) setIndex(Math.max(0, requests.length - 1))
    }, [requests.length, index])

    // Reseta o estado de rejeição ao trocar de pedido.
    useEffect(() => { setRejecting(false); setReason(""); setError(null) }, [index, requests.length])

    if (requests.length === 0) return null
    const req: CreationRequest | undefined = requests[index]
    if (!req) return null

    const isDelete = (req.actionName || "create") === "delete"
    const who = req.who || {}
    const s = req.session || {}
    const payload = req.payload || {}
    const targetKind = TYPE_LABEL[req.type] || req.type
    const targetName = isDelete
        ? (req.impact?.targetLabel || `${targetKind} ${req.targetId || ""}`)
        : (payload.name || payload.title || "(sem nome)")

    const approve = async () => {
        setBusy(true); setError(null)
        try {
            const { result } = await api.agents.approveCreation(req.id)
            await reload()
            // Em criação, navega para o que foi criado; em delete, apenas atualiza.
            if (!isDelete && result && result.id) {
                if (req.type === "board") {
                    const projectId = result.projectId || req.projectId
                    navigate(projectId ? `/projects/${projectId}/board/${result.id}` : `/projects/${result.id}`)
                } else if (req.type === "project") {
                    navigate(`/projects/${result.id}`)
                }
            }
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const confirmReject = async () => {
        setBusy(true); setError(null)
        try { await api.agents.rejectCreation(req.id, reason.trim() || undefined); await reload() }
        catch (e: any) { setError(e.message) } finally { setBusy(false); setRejecting(false); setReason("") }
    }

    return <div className="mpm-overlay mpm-overlay--top">
        <div className="mpm-modal mpm-modal--approval" role="alertdialog" aria-modal="true">
            <div className="mpm-modal__head">
                <Icon name={isDelete ? "trash" : "shield"}
                    style={isDelete ? { color: "var(--mp-danger)" } : undefined} />
                {isDelete ? "Remoção solicitada por agente" : "Criação solicitada por agente"}
                <span className="mpm-topbar__spacer" style={{ flex: 1 }} />
                {requests.length > 1
                    ? <span className="mpm-chip">{index + 1} de {requests.length}</span>
                    : null}
            </div>

            <div className="mpm-modal__body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {/* O QUE */}
                <div className="mpm-row" style={{ alignItems: "center" }}>
                    <span className={`mpm-badge ${isDelete ? "mpm-badge--type-bug" : "mpm-badge--type-epic"}`}>
                        {isDelete ? "Remover" : "Criar"} {targetKind}
                    </span>
                    <strong style={{ fontSize: "var(--mp-text-lg)", flex: 1 }}>{targetName}</strong>
                    {req.risk === "destructive"
                        ? <span className="mpm-chip mpm-chip--danger"><Icon name="warning sign" /> destrutivo</span>
                        : <span className="mpm-chip mpm-chip--warning"><Icon name="clock" /> pendente</span>}
                </div>

                {/* Impacto de deleção: o QUE será afetado */}
                {isDelete && req.impact
                    ? <div className="mpm-panel mpm-approval__impact">
                        <div className="mpm-section-title"><Icon name="exclamation triangle" /> O que será removido (soft delete, reversível)</div>
                        <div className="mpm-row" style={{ flexWrap: "wrap", gap: "var(--mp-space-2)" }}>
                            {Object.entries(req.impact.counts || {}).map(([k, v]) =>
                                <span key={k} className="mpm-chip">
                                    <strong>{v}</strong>&nbsp;{COUNT_LABEL[k] || k}
                                </span>)}
                            {Object.keys(req.impact.counts || {}).length === 0
                                ? <span className="mpm-muted">Sem dependências associadas.</span>
                                : null}
                        </div>
                    </div>
                    : null}

                {/* Descrição da criação */}
                {!isDelete && payload.description
                    ? <Markdown>{payload.description}</Markdown>
                    : null}

                {/* QUEM */}
                <div className="mpm-panel" style={{ background: "var(--mp-surface-2)" }}>
                    <div className="mpm-section-title"><Icon name="microchip" /> Quem solicitou</div>
                    <div className="mpm-grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                        {kv("Provider", who.provider || s.provider)}
                        {kv("Modelo", who.model || s.modelName)}
                        {kv("Objetivo", who.objective || s.objective)}
                        {kv("Sessão / trace", who.traceId || s.traceId)}
                        {kv("Host", who.host || s.host)}
                        {kv("Usuário SO", who.osUser || s.osUser)}
                        {kv("Diretório", s.workingDirectory)}
                        {kv("Repositório", s.repositoryUrl)}
                        {kv("Branch", s.branchName)}
                        {kv("Commit", s.commitHash)}
                    </div>
                </div>

                <span className="mpm-muted" style={{ fontSize: "12px" }}>
                    <Icon name="calendar outline" /> solicitado {formatDateTime(req.requestedAt)}
                </span>

                {rejecting
                    ? <div className="mpm-field">
                        <span className="mpm-field__label">Motivo da rejeição (opcional, auditado)</span>
                        <textarea className="mpm-textarea" autoFocus rows={2} value={reason}
                            placeholder="Ex.: não deve ser removido / criar manualmente depois"
                            onChange={(e) => setReason(e.target.value)} />
                    </div>
                    : null}

                <ErrorBanner error={error} />
            </div>

            <div className="mpm-modal__foot">
                {requests.length > 1 && !rejecting
                    ? <>
                        <button className="mpm-btn mpm-btn--ghost" disabled={busy || index === 0}
                            onClick={() => setIndex((i) => Math.max(0, i - 1))}><Icon name="chevron left" /></button>
                        <button className="mpm-btn mpm-btn--ghost" disabled={busy || index >= requests.length - 1}
                            onClick={() => setIndex((i) => Math.min(requests.length - 1, i + 1))}><Icon name="chevron right" /></button>
                        <span className="mpm-topbar__spacer" style={{ flex: 1 }} />
                    </>
                    : <span className="mpm-topbar__spacer" style={{ flex: 1 }} />}

                {rejecting
                    ? <>
                        <button className="mpm-btn" disabled={busy} onClick={() => setRejecting(false)}>Voltar</button>
                        <button className="mpm-btn mpm-btn--danger" disabled={busy} onClick={confirmReject}>
                            {busy ? <Icon name="spinner" loading /> : <Icon name="ban" />} Confirmar rejeição
                        </button>
                    </>
                    : <>
                        <button className="mpm-btn mpm-btn--danger" disabled={busy} onClick={() => setRejecting(true)}>
                            <Icon name="ban" /> Rejeitar
                        </button>
                        <button className="mpm-btn mpm-btn--primary" disabled={busy} onClick={approve}>
                            {busy ? <Icon name="spinner" loading /> : <Icon name="check" />}
                            {isDelete ? " Aprovar remoção" : " Aprovar criação"}
                        </button>
                    </>}
            </div>
        </div>
    </div>
}

export default GlobalApprovalModal
