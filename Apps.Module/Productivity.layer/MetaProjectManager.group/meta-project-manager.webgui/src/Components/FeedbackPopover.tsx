import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { FeedbackTarget } from "../Utils/feedbackTarget"
import { ErrorBanner } from "./Primitives"

export interface FeedbackAnchor {
    x: number
    y: number
    target: FeedbackTarget
    excerpt?: string
    screen?: string
}

interface FeedbackPopoverProps {
    anchor: FeedbackAnchor
    onClose: () => void
    onSent?: () => void
}

// Sugestões: feedback vago ("melhora aí") não ajuda o agente.
const SUGGESTIONS = [
    "Está longo demais — resuma.",
    "Seja mais assertivo e direto.",
    "Organize em seções com títulos.",
    "Falta o passo a passo de reprodução.",
    "Falta o resultado esperado.",
    "Está desatualizado."
]

const WIDTH = 380
const HEIGHT_GUESS = 300

// Balão que abre ONDE o usuário clicou com o botão direito, com uma caixa de
// texto: "o que você quer que o agente corrija aqui".
const FeedbackPopover = ({ anchor, onClose, onSent }: FeedbackPopoverProps) => {
    const api = useApi()
    const [text, setText] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose()
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("mousedown", onDown)
        window.addEventListener("keydown", onKey)
        return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey) }
    }, [onClose])

    const submit = async () => {
        if (!text.trim()) return
        setBusy(true); setError(null)
        try {
            await api.feedback.create({
                project: anchor.target.project,
                item: anchor.target.item,
                entityType: anchor.target.entityType,
                entityId: anchor.target.entityId,
                field: anchor.target.field,
                fieldLabel: anchor.target.fieldLabel,
                screen: anchor.screen,
                excerpt: anchor.excerpt,
                body: text.trim()
            })
            onSent && onSent()
            onClose()
        } catch (e: any) { setError(e.message); setBusy(false) }
    }

    // Mantém o balão dentro da janela, mesmo clicando na borda direita/inferior.
    const left = Math.min(anchor.x, window.innerWidth - WIDTH - 12)
    const top = Math.min(anchor.y, window.innerHeight - HEIGHT_GUESS - 12)

    const where = anchor.target.fieldLabel || anchor.target.field
    const scope = anchor.target.item || anchor.target.entityType

    return <div className="mpm-fb-popover" ref={ref}
        style={{ left: Math.max(8, left), top: Math.max(8, top), width: WIDTH }}
        role="dialog" aria-label="Feedback para o agente">

        <div className="mpm-fb-popover__head">
            <Icon name="comment alternate outline" />
            <strong style={{ flex: 1 }}>Feedback para o agente</strong>
            <span className="mpm-iconbtn" data-tip="Fechar" data-tip-shortcut="Esc" onClick={onClose}><Icon name="close" /></span>
        </div>

        <div className="mpm-fb-popover__where">
            {where ? <span className="mpm-chip mpm-chip--info">{where}</span> : null}
            {scope ? <span className="mpm-mono mpm-muted">{scope}</span> : null}
        </div>

        {anchor.excerpt
            ? <div className="mpm-fb-popover__excerpt" title="Trecho que será enviado como contexto">
                {anchor.excerpt.length > 160 ? `${anchor.excerpt.slice(0, 160)}…` : anchor.excerpt}
            </div>
            : null}

        <textarea className="mpm-textarea" autoFocus rows={4} value={text}
            placeholder="O que o agente deve corrigir aqui?"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit() }} />

        <div className="mpm-fb-popover__suggestions">
            {SUGGESTIONS.map((sug) =>
                <button key={sug} className="mpm-chip mpm-chip--neutral" type="button"
                    onClick={() => setText((t) => t.trim() ? `${t.trim()}\n- ${sug}` : `- ${sug}`)}>
                    {sug}
                </button>)}
        </div>

        <ErrorBanner error={error} />

        <div className="mpm-fb-popover__foot">
            <span className="mpm-muted" style={{ flex: 1, fontSize: "11px" }}>Ctrl+Enter envia</span>
            <button className="mpm-btn mpm-btn--sm" onClick={onClose} disabled={busy}>Cancelar</button>
            <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={submit} disabled={busy || !text.trim()}>
                {busy ? <Icon name="spinner" loading /> : <Icon name="paper plane" />} Enviar
            </button>
        </div>
    </div>
}

export default FeedbackPopover
