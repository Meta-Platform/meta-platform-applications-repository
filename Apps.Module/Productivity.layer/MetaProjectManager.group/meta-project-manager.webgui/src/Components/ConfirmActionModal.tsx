import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "semantic-ui-react"

import { ErrorBanner } from "./Primitives"

export interface ConfirmActionModalProps {
    title: string
    message?: React.ReactNode
    // Lista do que acontece ao confirmar (consequências explícitas).
    consequences?: React.ReactNode[]
    confirmLabel?: string
    cancelLabel?: string
    // Botão de confirmação vermelho (ação destrutiva).
    danger?: boolean
    // Se definido, o usuário precisa DIGITAR exatamente este texto (nome/slug/key)
    // para habilitar a confirmação — trava para deleção de alto impacto.
    requireText?: string
    busy?: boolean
    error?: string | null
    onConfirm: () => void
    onCancel: () => void
}

// Modal de confirmação reutilizável (spec §6/P0.5) — substitui window.confirm.
// Regras: Esc cancela (nunca confirma); o botão Cancelar recebe foco inicial;
// ação destrutiva com requireText só habilita ao digitar o texto exato; o botão
// destrutivo é vermelho e fica à direita.
const ConfirmActionModal = ({
    title, message, consequences, confirmLabel = "Confirmar", cancelLabel = "Cancelar",
    danger, requireText, busy, error, onConfirm, onCancel
}: ConfirmActionModalProps) => {
    const [typed, setTyped] = useState("")
    const cancelRef = useRef<HTMLButtonElement>(null)
    const textMatches = !requireText || typed.trim() === requireText.trim()
    const confirmEnabled = !busy && textMatches

    useEffect(() => { cancelRef.current?.focus() }, [])
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onCancel() } }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onCancel])

    return <div className="mpm-overlay mpm-overlay--top"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
        <div className="mpm-modal mpm-modal--confirm" role="alertdialog" aria-modal="true">
            <div className="mpm-modal__head">
                <Icon name={danger ? "warning sign" : "help circle"}
                    style={danger ? { color: "var(--mp-danger)" } : undefined} />
                {title}
            </div>
            <div className="mpm-modal__body">
                {message ? <div className="mpm-confirm__msg">{message}</div> : null}
                {consequences && consequences.length > 0
                    ? <ul className="mpm-confirm__list">
                        {consequences.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                    : null}
                {requireText
                    ? <div className="mpm-field">
                        <span className="mpm-field__label">
                            Digite <code className="mpm-mono">{requireText}</code> para confirmar
                        </span>
                        <input className="mpm-input" autoFocus value={typed}
                            placeholder={requireText}
                            onChange={(e) => setTyped(e.target.value)} />
                    </div>
                    : null}
                <ErrorBanner error={error || null} />
            </div>
            <div className="mpm-modal__foot">
                <button ref={cancelRef} className="mpm-btn" onClick={onCancel} disabled={busy}>
                    {cancelLabel}
                </button>
                <button className={`mpm-btn ${danger ? "mpm-btn--danger" : "mpm-btn--primary"}`}
                    disabled={!confirmEnabled} onClick={onConfirm}>
                    {busy ? <Icon name="spinner" loading /> : <Icon name={danger ? "trash" : "check"} />}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
}

export default ConfirmActionModal
