import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { WorkItem } from "../api/types"
import { Modal, ErrorBanner } from "./Primitives"

// Sobre o que o usuário está dando feedback. O agente lê isso via MCP
// (`list_comments` / `get_item`) e sabe exatamente o que reescrever.
type Target = "titulo" | "descricao" | "ambos"

const TARGETS: { key: Target; label: string; icon: any; hint: string }[] = [
    { key: "titulo",    label: "Título",    icon: "header",     hint: "O agente deve reescrever o TÍTULO do item" },
    { key: "descricao", label: "Descrição", icon: "align left", hint: "O agente deve reescrever a DESCRIÇÃO do item" },
    { key: "ambos",     label: "Ambos",     icon: "clone",      hint: "O agente deve revisar título e descrição" }
]

const TARGET_TEXT: Record<Target, string> = {
    titulo: "o TÍTULO",
    descricao: "a DESCRIÇÃO",
    ambos: "o TÍTULO e a DESCRIÇÃO"
}

// Sugestões rápidas — evitam feedback vago ("melhora aí").
const SUGGESTIONS = [
    "Resuma: está longo demais.",
    "Seja mais assertivo e direto.",
    "Organize em seções com títulos.",
    "Falta o passo a passo de reprodução.",
    "Falta o resultado esperado.",
    "Remova jargão desnecessário."
]

interface AgentFeedbackModalProps {
    item: WorkItem
    onClose: () => void
    onSent?: () => void
}

// Feedback direcionado a um agente sobre o texto de um item. É gravado como
// COMENTÁRIO do item (canal que os agentes já leem antes de agir, via MCP
// `list_comments`), num formato estruturado e sem ambiguidade.
const AgentFeedbackModal = ({ item, onClose, onSent }: AgentFeedbackModalProps) => {
    const api = useApi()
    const [target, setTarget] = useState<Target>("descricao")
    const [text, setText] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const addSuggestion = (s: string) =>
        setText((t) => (t.trim() ? `${t.trim()}\n- ${s}` : `- ${s}`))

    const submit = async () => {
        if (!text.trim()) return
        setBusy(true); setError(null)
        const body = [
            `**Feedback para o agente — reescrever ${TARGET_TEXT[target]}**`,
            "",
            text.trim(),
            "",
            `_Alvo: \`${target}\` · item \`${item.key}\`. Aplique diretamente com \`update_item\` e comente o que mudou._`
        ].join("\n")
        try {
            await api.comments.add(item.id, body, "markdown")
            onSent && onSent()
            onClose()
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    return <Modal title={`Feedback para agente · ${item.key}`} icon="comment alternate" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !text.trim()}>
                {busy ? <Icon name="spinner" loading /> : <Icon name="paper plane" />} Enviar feedback
            </button>
        </>}>
        <ErrorBanner error={error} />

        <div className="mpm-field">
            <span className="mpm-field__label">Sobre o que é o feedback</span>
            <div className="mpm-seg">
                {TARGETS.map((t) =>
                    <button key={t.key} type="button" title={t.hint}
                        className={`mpm-seg__btn ${target === t.key ? "is-active" : ""}`}
                        onClick={() => setTarget(t.key)}>
                        <Icon name={t.icon} /> {t.label}
                    </button>)}
            </div>
        </div>

        <div className="mpm-field">
            <span className="mpm-field__label">Item</span>
            <div className="mpm-muted" style={{ fontSize: 12 }}>{item.title}</div>
        </div>

        <div className="mpm-field">
            <span className="mpm-field__label">O que você quer que o agente faça</span>
            <textarea className="mpm-textarea" autoFocus rows={5} value={text}
                placeholder={`Ex.: reescreva ${TARGET_TEXT[target].toLowerCase()} de forma mais curta e objetiva, com seções.`}
                onChange={(e) => setText(e.target.value)} />
        </div>

        <div className="mpm-field">
            <span className="mpm-field__label">Sugestões rápidas</span>
            <div className="mpm-row mpm-wrap" style={{ gap: 6 }}>
                {SUGGESTIONS.map((s) =>
                    <button key={s} type="button" className="mpm-btn mpm-btn--ghost mpm-btn--sm"
                        onClick={() => addSuggestion(s)}>+ {s}</button>)}
            </div>
        </div>
    </Modal>
}

export default AgentFeedbackModal
