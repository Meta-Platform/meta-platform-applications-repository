import * as React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import FeedbackPopover, { FeedbackAnchor } from "../Components/FeedbackPopover"
import { targetAt, excerptAt } from "../Utils/feedbackTarget"

interface FeedbackBus {
    // Abre o balão manualmente (ex.: a partir de outro menu de contexto).
    openAt: (anchor: FeedbackAnchor) => void
}

const FeedbackContext = createContext<FeedbackBus | null>(null)

interface MenuState { x: number; y: number; anchor: FeedbackAnchor }

// Botão direito em qualquer campo anotado com `data-feedback` abre um menu com
// "Feedback para o agente"; escolher abre o balão AO LADO do clique.
//
// Um listener só, no document: espalhar handlers por todo input seria fácil de
// esquecer no próximo componente. Elementos sem anotação seguem com o menu
// nativo do navegador (copiar/colar continua funcionando).
export const FeedbackProvider = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation()
    const [menu, setMenu] = useState<MenuState | null>(null)
    const [popover, setPopover] = useState<FeedbackAnchor | null>(null)

    const openAt = useCallback((anchor: FeedbackAnchor) => { setMenu(null); setPopover(anchor) }, [])

    useEffect(() => {
        const onContextMenu = (e: MouseEvent) => {
            // Outro menu de contexto (ex.: o do card no board) já tratou o clique.
            if (e.defaultPrevented) return
            const element = e.target as HTMLElement
            const target = targetAt(element)
            if (!target) return

            e.preventDefault()
            const anchor: FeedbackAnchor = {
                x: e.clientX, y: e.clientY,
                target,
                excerpt: excerptAt(element),
                screen: location.pathname
            }
            setPopover(null)
            setMenu({ x: e.clientX, y: e.clientY, anchor })
        }
        document.addEventListener("contextmenu", onContextMenu)
        return () => document.removeEventListener("contextmenu", onContextMenu)
    }, [location.pathname])

    // Fecha o menu ao clicar fora / Esc.
    useEffect(() => {
        if (!menu) return
        const close = () => setMenu(null)
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
        window.addEventListener("mousedown", close)
        window.addEventListener("keydown", onKey)
        return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", onKey) }
    }, [menu])

    const value = useMemo(() => ({ openAt }), [openAt])

    return <FeedbackContext.Provider value={value}>
        {children}

        {menu
            ? <div className="mpm-ctxmenu" style={{ left: menu.x, top: menu.y }}
                onMouseDown={(e) => e.stopPropagation()}>
                <button className="mpm-ctxmenu__item" onClick={() => openAt(menu.anchor)}>
                    <Icon name="comment alternate outline" /> Feedback para o agente
                    {menu.anchor.target.fieldLabel
                        ? <span className="mpm-muted">&nbsp;· {menu.anchor.target.fieldLabel}</span>
                        : null}
                </button>
            </div>
            : null}

        {popover
            ? <FeedbackPopover anchor={popover} onClose={() => setPopover(null)} />
            : null}
    </FeedbackContext.Provider>
}

const NOOP: FeedbackBus = { openAt: () => {} }
export const useFeedback = (): FeedbackBus => useContext(FeedbackContext) || NOOP

export default useFeedback
