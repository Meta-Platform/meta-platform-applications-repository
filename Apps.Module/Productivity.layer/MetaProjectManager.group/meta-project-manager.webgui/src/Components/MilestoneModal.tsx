import * as React from "react"
import { useState } from "react"

import useApi from "../Hooks/useApi"
import { Milestone } from "../api/types"
import { Modal, ErrorBanner } from "./Primitives"

const STATUSES = ["open", "completed", "closed"]

interface MilestoneModalProps {
    projectId: string
    milestone?: Milestone           // presente = edição
    onClose: () => void
    onSaved: (m: Milestone) => void
}

const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : "")

const MilestoneModal = ({ projectId, milestone, onClose, onSaved }: MilestoneModalProps) => {
    const api = useApi()
    const [name, setName] = useState(milestone ? milestone.name : "")
    const [description, setDescription] = useState(milestone ? (milestone.description || "") : "")
    const [targetDate, setTargetDate] = useState(toDateInput(milestone && milestone.targetDate))
    const [status, setStatus] = useState(milestone ? milestone.status : "open")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        if (!name.trim()) return
        setBusy(true); setError(null)
        try {
            const input = { name: name.trim(), description: description.trim() || undefined, targetDate: targetDate || undefined, status }
            const saved = milestone
                ? await api.planning.updateMilestone(milestone.id, input)
                : await api.planning.createMilestone(projectId, input)
            onSaved(saved)
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    return <Modal title={milestone ? "Editar milestone" : "Novo milestone"} icon="flag" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !name.trim()}>Salvar</button>
        </>}>
        <ErrorBanner error={error} />
        <div className="mpm-field"><span className="mpm-field__label">Nome</span>
            <input className="mpm-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="mpm-row mpm-gap-4">
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Data-alvo</span>
                <input className="mpm-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Status</span>
                <select className="mpm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
        </div>
        <div className="mpm-field"><span className="mpm-field__label">Descrição</span>
            <textarea className="mpm-textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    </Modal>
}

export default MilestoneModal
