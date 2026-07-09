import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useApprovalQueue from "../Hooks/useApprovalQueue"
import { CreationRequest } from "../api/types"
import Markdown from "./Markdown"
import { ErrorBanner } from "./Primitives"
import { formatDateTime } from "../Utils/format"

// Rótulos legíveis por tipo de alvo (nomes da interface, não do jargão técnico).
const TYPE_LABEL: Record<string, string> = {
    project: "projeto", board: "board", milestone: "entrega", sprint: "sprint", item: "item",
    column: "coluna", "checklist-item": "passo de checklist", "acceptance-criteria": "critério de aceite",
    "work-item": "item"
}
const COUNT_LABEL: Record<string, string> = {
    boards: "boards", items: "itens", attachments: "anexos", comments: "comentários", children: "subitens"
}

// Cada ação pendente tem verbo, ícone e nível de alarme próprios.
interface ActionStyle { verb: string; title: string; icon: string; danger: boolean }
const ACTION_STYLE: Record<string, ActionStyle> = {
    create:        { verb: "Criar",     title: "Criação solicitada por agente",   icon: "shield",        danger: false },
    delete:        { verb: "Remover",   title: "Remoção solicitada por agente",   icon: "trash",         danger: true },
    update:        { verb: "Alterar",   title: "Alteração solicitada por agente", icon: "pencil",        danger: false },
    archive:       { verb: "Arquivar",  title: "Arquivamento solicitado por agente", icon: "archive",    danger: true },
    restore:       { verb: "Restaurar", title: "Restauração solicitada por agente",  icon: "undo",       danger: false },
    move:          { verb: "Mover",     title: "Reordenação solicitada por agente",  icon: "arrows alternate horizontal", danger: false },
    "set-default": { verb: "Tornar padrão", title: "Troca de board padrão solicitada por agente", icon: "star", danger: false }
}
const styleOf = (actionName: string): ActionStyle =>
    ACTION_STYLE[actionName] || { verb: actionName, title: "Ação solicitada por agente", icon: "shield", danger: false }

// Campos do payload que valem mostrar ao humano, na ordem em que ele lê.
const FIELD_LABEL: Record<string, string> = {
    name: "nome", slug: "slug", shortDescription: "resumo", description: "descrição",
    status: "status", statusKey: "chave de status", order: "posição", color: "cor",
    wipLimit: "limite de WIP", isDoneColumn: "coluna de concluído", targetDate: "data-alvo",
    goal: "objetivo", repositoryUrl: "repositório", localPath: "caminho local", keyPrefix: "prefixo de key"
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
    const { active: requests, snooze, reload } = useApprovalQueue()
    const [index, setIndex] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState(false)
    const [showDesc, setShowDesc] = useState(false)
    const [showSession, setShowSession] = useState(false)
    const [reason, setReason] = useState("")

    // Mantém o índice dentro dos limites quando a fila muda.
    useEffect(() => {
        if (index >= requests.length) setIndex(Math.max(0, requests.length - 1))
    }, [requests.length, index])

    // Reseta o estado de rejeição ao trocar de pedido.
    useEffect(() => { setRejecting(false); setReason(""); setError(null); setShowDesc(false); setShowSession(false) }, [index, requests.length])

    if (requests.length === 0) return null
    const req: CreationRequest | undefined = requests[index]
    if (!req) return null

    const actionName = req.actionName || "create"
    const isDelete = actionName === "delete"
    const isCreate = actionName === "create"
    const action = styleOf(actionName)
    const who = req.who || {}
    const s = req.session || {}
    const payload = req.payload || {}
    const targetKind = TYPE_LABEL[req.type] || req.type
    const targetName = isCreate
        ? (payload.name || payload.title || "(sem nome)")
        : (req.impact?.targetLabel || payload.name || `${targetKind} ${req.targetId || ""}`)

    // "update" precisa mostrar O QUE muda — é o texto/estrutura que o humano revisa.
    const changedFields = actionName === "update"
        ? Object.keys(payload).filter((k) => payload[k] !== undefined && k !== "project")
        : []

    const approve = async () => {
        setBusy(true); setError(null)
        try {
            const { result } = await api.agents.approveCreation(req.id)
            await reload()
            // Em criação, navega para o que foi criado; em delete, apenas atualiza.
            if (isCreate && result && result.id) {
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

    return <div className="mpm-overlay mpm-overlay--top mpm-overlay--approval">
        <div className="mpm-modal mpm-modal--approval" role="alertdialog" aria-modal="true">
            <div className="mpm-modal__head">
                <Icon name={action.icon as any}
                    style={action.danger ? { color: "var(--mp-danger)" } : undefined} />
                {action.title}
                <span className="mpm-topbar__spacer" style={{ flex: 1 }} />
                {requests.length > 1
                    ? <span className="mpm-chip">{index + 1} de {requests.length}</span>
                    : null}
            </div>

            <div className="mpm-approval__waiting">
                <Icon name="hourglass half" /> O agente está <strong>parado</strong> esperando sua decisão.
            </div>

            <div className="mpm-modal__body mpm-approval__body">
                {/* O QUE — linha assertiva: ação + alvo + risco */}
                <div className="mpm-row" style={{ alignItems: "center" }}>
                    <span className={`mpm-badge ${action.danger ? "mpm-badge--type-bug" : "mpm-badge--type-epic"}`}>
                        {action.verb} {targetKind}
                    </span>
                    <strong className="mpm-approval__target" title={targetName}>{targetName}</strong>
                    {req.risk === "destructive"
                        ? <span className="mpm-chip mpm-chip--danger"><Icon name="warning sign" /> destrutivo</span>
                        : <span className="mpm-chip mpm-chip--warning"><Icon name="clock" /> pendente</span>}
                </div>

                {/* Resumo em uma linha (quando o agente informou shortDescription) */}
                {isCreate && payload.shortDescription
                    ? <p className="mpm-approval__lead">{payload.shortDescription}</p>
                    : null}

                {/* ALTERAÇÃO: o humano precisa ver exatamente o que vai mudar. */}
                {changedFields.length > 0
                    ? <div className="mpm-panel">
                        <div className="mpm-section-title"><Icon name="pencil" /> O que muda</div>
                        <div className="mpm-col mpm-gap-2">
                            {changedFields.map((field) =>
                                <div key={field} className="mpm-field">
                                    <span className="mpm-field__label">{FIELD_LABEL[field] || field}</span>
                                    {field === "description"
                                        ? <div className="mpm-approval__scroll"><Markdown>{String(payload[field])}</Markdown></div>
                                        : <div style={{ wordBreak: "break-word" }}>{String(payload[field])}</div>}
                                </div>)}
                        </div>
                    </div>
                    : null}

                {/* QUEM — compacto, sempre visível, sem dossiê */}
                <div className="mpm-approval__facts">
                    <span><b>Quem</b> {who.provider || s.provider || "agente"}{(who.model || s.modelName) ? ` · ${who.model || s.modelName}` : ""}</span>
                    <span><b>Sessão</b> <code className="mpm-mono">{who.traceId || s.traceId || "—"}</code></span>
                    <span><b>Quando</b> {formatDateTime(req.requestedAt)}</span>
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

                {/* Descrição longa: RECOLHIDA por padrão (antes dominava o modal) */}
                {isCreate && payload.description
                    ? <div className="mpm-approval__section">
                        <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={() => setShowDesc((v) => !v)}>
                            <Icon name={showDesc ? "caret down" : "caret right"} /> Descrição completa
                        </button>
                        {showDesc ? <div className="mpm-approval__scroll"><Markdown>{payload.description}</Markdown></div> : null}
                    </div>
                    : null}

                {/* Dossiê forense da sessão: recolhido */}
                <div className="mpm-approval__section">
                    <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={() => setShowSession((v) => !v)}>
                        <Icon name={showSession ? "caret down" : "caret right"} /> Detalhes da sessão
                    </button>
                    {showSession
                        ? <div className="mpm-grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
                            {kv("Objetivo", who.objective || s.objective)}
                            {kv("Host", who.host || s.host)}
                            {kv("Usuário SO", who.osUser || s.osUser)}
                            {kv("Diretório", s.workingDirectory)}
                            {kv("Repositório", s.repositoryUrl)}
                            {kv("Branch", s.branchName)}
                            {kv("Commit", s.commitHash)}
                        </div>
                        : null}
                </div>

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
                        <button className="mpm-btn mpm-btn--ghost" disabled={busy}
                            title="Sai da frente, mas o pedido continua pendente — e o agente continua esperando"
                            onClick={() => snooze(req.id)}>
                            <Icon name="clock outline" /> Depois
                        </button>
                        <button className="mpm-btn mpm-btn--danger" disabled={busy} onClick={() => setRejecting(true)}>
                            <Icon name="ban" /> Rejeitar
                        </button>
                        <button className="mpm-btn mpm-btn--primary" disabled={busy} onClick={approve}>
                            {busy ? <Icon name="spinner" loading /> : <Icon name="check" />}
                            {` Aprovar (${action.verb.toLowerCase()} ${targetKind})`}
                        </button>
                    </>}
            </div>
        </div>
    </div>
}

export default GlobalApprovalModal
