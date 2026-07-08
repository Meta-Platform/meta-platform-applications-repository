import * as React from "react"
import { Icon } from "semantic-ui-react"

import { CreationRequest } from "../api/types"
import Markdown from "./Markdown"
import { formatDateTime } from "../Utils/format"

interface CreationRequestCardProps {
    request: CreationRequest
    busy?: boolean
    onApprove: () => void
    onReject: () => void
}

const detail = (label: string, value?: React.ReactNode) =>
    (value === undefined || value === null || value === "")
        ? null
        : <div className="mpm-field">
            <span className="mpm-field__label">{label}</span>
            <div className="mpm-mono" style={{ fontSize: "12px", wordBreak: "break-all" }}>{value}</div>
        </div>

// CreationRequestCard: um pedido de criação (projeto/board) feito por um agente
// e bloqueado, aguardando decisão humana. Mostra o alvo + o dossiê forense da
// sessão do agente e os botões Aprovar/Rejeitar.
const CreationRequestCard = ({ request, busy, onApprove, onReject }: CreationRequestCardProps) => {
    const s = request.session || {}
    const payload = request.payload || {}
    const isBoard = request.type === "board"
    const requestedName = payload.name || payload.title || "(sem nome)"

    return <div className="mpm-card mpm-col mpm-gap-4">
        <div className="mpm-row">
            <span className={`mpm-badge ${isBoard ? "mpm-badge--type-story" : "mpm-badge--type-epic"}`}>
                {isBoard ? "Board" : "Projeto"}
            </span>
            <strong style={{ fontSize: "var(--mp-text-lg)", flex: 1 }}>{requestedName}</strong>
            <span className="mpm-chip mpm-chip--warning"><Icon name="clock" /> pendente</span>
        </div>

        {payload.description
            ? <Markdown>{payload.description}</Markdown>
            : null}

        <div className="mpm-panel" style={{ background: "var(--mp-surface-2)" }}>
            <div className="mpm-section-title"><Icon name="microchip" /> Agente / sessão</div>
            <div className="mpm-grid-cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {detail("Provider", s.provider)}
                {detail("Modelo", s.modelName)}
                {detail("Host", s.host)}
                {detail("Usuário SO", s.osUser)}
                {detail("PID", s.pid)}
                {detail("Versão do agente", s.agentVersion)}
                {detail("Diretório", s.workingDirectory)}
                {detail("Repositório", s.repositoryUrl)}
                {detail("Branch", s.branchName)}
                {detail("Commit", s.commitHash)}
                {detail("1ª tentativa", formatDateTime(s.firstAttemptAt))}
                {detail("Ação inicial", s.firstAttemptAction)}
                {detail("Nº de ações", s.actionCount)}
                {detail("Última atividade", formatDateTime(s.lastActivityAt))}
                {detail("Trace ID", s.traceId)}
                {detail("Sessão externa", s.externalSessionId)}
            </div>
        </div>

        <div className="mpm-row">
            <span className="mpm-muted" style={{ fontSize: "12px", flex: 1 }}>
                <Icon name="calendar outline" /> solicitado {formatDateTime(request.requestedAt)}
            </span>
            <button className="mpm-btn mpm-btn--danger" disabled={busy} onClick={onReject}>
                <Icon name="ban" /> Rejeitar
            </button>
            <button className="mpm-btn mpm-btn--primary" disabled={busy} onClick={onApprove}>
                <Icon name="check" /> Aprovar
            </button>
        </div>
    </div>
}

export default CreationRequestCard
