import * as React from "react"
import { useState } from "react"

import useApi from "../Hooks/useApi"
import { WorkItem, WORK_ITEM_TYPES } from "../api/types"
import { Modal, ErrorBanner } from "./Primitives"

const TYPES = WORK_ITEM_TYPES
const PRIORITIES = ["none", "low", "medium", "high", "urgent"]

interface NewItemModalProps {
    projectId: string
    boardId?: string
    defaultStatus?: string
    // Item já nasce sob este pai (ex.: criado numa faixa de épico do board).
    defaultParent?: string
    defaultParentLabel?: string
    onClose: () => void
    onCreated: (item: WorkItem) => void
}

const NewItemModal = ({ projectId, boardId, defaultStatus, defaultParent, defaultParentLabel, onClose, onCreated }: NewItemModalProps) => {
    const api = useApi()
    const [title, setTitle] = useState("")
    const [type, setType] = useState("task")
    const [priority, setPriority] = useState("none")
    const [description, setDescription] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        if (!title.trim()) return
        setBusy(true); setError(null)
        try {
            const item = await api.items.create(projectId, {
                title: title.trim(),
                type,
                priority,
                description: description.trim() || undefined,
                board: boardId,
                status: defaultStatus,
                parent: defaultParent
            })
            onCreated(item)
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    return <Modal title="Nova tarefa" icon="plus" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !title.trim()}>Criar</button>
        </>}>
        <ErrorBanner error={error} />
        {defaultParent
            ? <div className="mpm-muted" style={{ fontSize: 12, marginBottom: "var(--mp-space-2)" }}>
                Será criado dentro de <b>{defaultParentLabel || defaultParent}</b>.
            </div>
            : null}
        <div className="mpm-field"><span className="mpm-field__label">Título</span>
            <input className="mpm-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="mpm-row mpm-gap-4">
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Tipo</span>
                <select className="mpm-select" value={type} onChange={(e) => setType(e.target.value)}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Prioridade</span>
                <select className="mpm-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select></div>
        </div>
        <div className="mpm-field"><span className="mpm-field__label">Descrição</span>
            <textarea className="mpm-textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    </Modal>
}

export default NewItemModal
