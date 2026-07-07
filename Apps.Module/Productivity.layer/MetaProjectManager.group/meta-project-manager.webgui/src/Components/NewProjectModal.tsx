import * as React from "react"
import { useState } from "react"

import useApi from "../Hooks/useApi"
import { Project } from "../api/types"
import { Modal, ErrorBanner } from "./Primitives"

interface NewProjectModalProps {
    onClose: () => void
    onCreated: (project: Project) => void
}

const NewProjectModal = ({ onClose, onCreated }: NewProjectModalProps) => {
    const api = useApi()
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [keyPrefix, setKeyPrefix] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async () => {
        if (!name.trim()) return
        setBusy(true); setError(null)
        try {
            const p = await api.projects.create({
                name: name.trim(),
                description: description.trim() || undefined,
                keyPrefix: keyPrefix.trim() || undefined
            })
            onCreated(p)
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    return <Modal title="Novo projeto" icon="folder" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !name.trim()}>Criar projeto</button>
        </>}>
        <ErrorBanner error={error} />
        <div className="mpm-field"><span className="mpm-field__label">Nome</span>
            <input className="mpm-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="mpm-field"><span className="mpm-field__label">Prefixo de chave (ex.: MPM)</span>
            <input className="mpm-input" value={keyPrefix} onChange={(e) => setKeyPrefix(e.target.value.toUpperCase())} /></div>
        <div className="mpm-field"><span className="mpm-field__label">Descrição</span>
            <textarea className="mpm-textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    </Modal>
}

export default NewProjectModal
