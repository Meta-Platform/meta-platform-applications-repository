import * as React from "react"
import { useState } from "react"

import useApi from "../Hooks/useApi"
import { Board } from "../api/types"
import { Modal, ErrorBanner } from "./Primitives"

const BOARD_TYPES = ["kanban", "scrum", "list"]

interface NewBoardModalProps {
    projectId: string
    onClose: () => void
    onCreated: (board: Board) => void
}

const NewBoardModal = ({ projectId, onClose, onCreated }: NewBoardModalProps) => {
    const api = useApi()
    const [name, setName] = useState("")
    const [type, setType] = useState("kanban")
    const [description, setDescription] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        if (!name.trim()) return
        setBusy(true); setError(null)
        try {
            const b = await api.boards.create(projectId, { name: name.trim(), type, description: description.trim() || undefined })
            onCreated(b)
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    return <Modal title="Novo board" icon="columns" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !name.trim()}>Criar board</button>
        </>}>
        <ErrorBanner error={error} />
        <div className="mpm-field"><span className="mpm-field__label">Nome</span>
            <input className="mpm-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="mpm-field"><span className="mpm-field__label">Tipo</span>
            <select className="mpm-select" value={type} onChange={(e) => setType(e.target.value)}>
                {BOARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
        <div className="mpm-field"><span className="mpm-field__label">Descrição</span>
            <textarea className="mpm-textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    </Modal>
}

export default NewBoardModal
