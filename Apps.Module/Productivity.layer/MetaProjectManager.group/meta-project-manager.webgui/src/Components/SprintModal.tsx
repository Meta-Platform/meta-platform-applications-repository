import * as React from "react"
import { useState } from "react"

import useApi from "../Hooks/useApi"
import { Sprint } from "../api/types"
import { Modal, ErrorBanner } from "./Primitives"

const STATUSES = ["planned", "active", "completed", "archived"]

interface SprintModalProps {
    projectId: string
    sprint?: Sprint                 // presente = edição
    onClose: () => void
    onSaved: (s: Sprint) => void
}

const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : "")

const SprintModal = ({ projectId, sprint, onClose, onSaved }: SprintModalProps) => {
    const api = useApi()
    const [name, setName] = useState(sprint ? sprint.name : "")
    const [goal, setGoal] = useState(sprint ? (sprint.goal || "") : "")
    const [startDate, setStartDate] = useState(toDateInput(sprint && sprint.startDate))
    const [endDate, setEndDate] = useState(toDateInput(sprint && sprint.endDate))
    const [status, setStatus] = useState(sprint ? sprint.status : "planned")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        if (!name.trim()) return
        setBusy(true); setError(null)
        try {
            const input = { name: name.trim(), goal: goal.trim() || undefined, startDate: startDate || undefined, endDate: endDate || undefined, status }
            const saved = sprint
                ? await api.planning.updateSprint(sprint.id, input)
                : await api.planning.createSprint(projectId, input)
            onSaved(saved)
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    return <Modal title={sprint ? "Editar sprint" : "Novo sprint"} icon="rocket" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !name.trim()}>Salvar</button>
        </>}>
        <ErrorBanner error={error} />
        <div className="mpm-field"><span className="mpm-field__label">Nome</span>
            <input className="mpm-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="mpm-row mpm-gap-4">
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Início</span>
                <input className="mpm-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Fim</span>
                <input className="mpm-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        <div className="mpm-field"><span className="mpm-field__label">Status</span>
            <select className="mpm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
        <div className="mpm-field"><span className="mpm-field__label">Objetivo</span>
            <textarea className="mpm-textarea" value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
    </Modal>
}

export default SprintModal
