import * as React from "react"
import { Icon } from "semantic-ui-react"

import { AgentSession } from "../api/types"
import { Modal } from "./Primitives"
import Markdown from "./Markdown"
import { formatDateTime } from "../Utils/format"

interface AgentSessionConfirmationModalProps {
    session: AgentSession
    onConfirm: () => void
    onReject: () => void
    onClose: () => void
    busy?: boolean
}

// AgentSessionConfirmationModal (spec §11.1): fluxo de aprovação de sessões
// de agente em estado pending_confirmation.
const AgentSessionConfirmationModal = ({ session, onConfirm, onReject, onClose, busy }: AgentSessionConfirmationModalProps) =>
    <Modal title="Confirmar sessão de agente" icon="shield" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--danger" onClick={onReject} disabled={busy}><Icon name="ban" /> Rejeitar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={onConfirm} disabled={busy}><Icon name="check" /> Confirmar</button>
        </>}>
        <div className="mpm-field"><span className="mpm-field__label">Sessão</span>
            <div>{session.sessionName || session.id}</div></div>
        <div className="mpm-row mpm-wrap mpm-gap-4">
            <div className="mpm-field"><span className="mpm-field__label">Provider</span><div>{session.provider}</div></div>
            <div className="mpm-field"><span className="mpm-field__label">Modelo</span><div className="mpm-mono">{session.modelName}</div></div>
            <div className="mpm-field"><span className="mpm-field__label">Criada</span><div>{formatDateTime(session.createdAt)}</div></div>
        </div>
        {session.objective
            ? <div className="mpm-field"><span className="mpm-field__label">Objetivo</span>
                <Markdown>{session.objective}</Markdown></div>
            : null}
        <div className="mpm-muted" style={{ fontSize: "12px" }}>
            Confirmar autoriza a sessão a atuar no workspace; rejeitar a descarta.
        </div>
    </Modal>

export default AgentSessionConfirmationModal
