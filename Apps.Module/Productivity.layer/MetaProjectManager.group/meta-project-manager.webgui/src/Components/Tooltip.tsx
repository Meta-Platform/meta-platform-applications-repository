import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

// Tooltip acessível ÚNICO (MPMB-60).
//
// Segue o idioma que já existe nesta GUI (ver Utils/feedbackTarget + useFeedback):
// um listener global lê a anotação mais próxima do alvo em vez de espalhar estado
// por cada botão. Aqui o alvo se anota com `data-tip="texto"` (e opcionalmente
// `data-tip-shortcut="Ctrl+C"`), e esta camada mostra o balão.
//
// Requisitos atendidos: abre no HOVER e no FOCO de teclado; fecha no mouseout /
// blur / Esc / scroll; `role="tooltip"` + `aria-describedby` no gatilho; renderiza
// em portal com posição FIXA (não é cortado por `overflow:hidden` de modal/tabela)
// e reposiciona para caber na viewport; `pointer-events:none` (nunca bloqueia).
// Não contém conteúdo interativo — para isso use um popover, não o tooltip.

export const TIP_ATTR = "data-tip"
const SHORTCUT_ATTR = "data-tip-shortcut"
const SHOW_DELAY = 420
const TOOLTIP_ID = "mpm-tooltip"

interface TipState {
    text: string
    shortcut?: string
    x: number
    y: number
    place: "top" | "bottom"
}

export const TooltipLayer = () => {
    const [tip, setTip] = useState<TipState | null>(null)
    const timer = useRef<any>(null)
    const targetRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
        const hide = () => {
            clear()
            if (targetRef.current) { targetRef.current.removeAttribute("aria-describedby"); targetRef.current = null }
            setTip(null)
        }

        const onEnter = (e: Event) => {
            const raw = e.target as HTMLElement | null
            const el = raw && raw.closest ? (raw.closest(`[${TIP_ATTR}]`) as HTMLElement | null) : null
            if (!el || el === targetRef.current) return
            const text = el.getAttribute(TIP_ATTR) || ""
            if (!text) return
            clear()
            timer.current = setTimeout(() => {
                const box = el.getBoundingClientRect()
                const place: "top" | "bottom" = box.top > 90 ? "top" : "bottom"
                targetRef.current = el
                el.setAttribute("aria-describedby", TOOLTIP_ID)
                setTip({
                    text,
                    shortcut: el.getAttribute(SHORTCUT_ATTR) || undefined,
                    x: box.left + box.width / 2,
                    y: place === "top" ? box.top : box.bottom,
                    place
                })
            }, SHOW_DELAY)
        }

        const onLeave = (e: Event) => {
            const raw = e.target as HTMLElement | null
            const el = raw && raw.closest ? raw.closest(`[${TIP_ATTR}]`) : null
            if (el && el === targetRef.current) hide()
            else if (!targetRef.current) clear()
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide() }
        const onScrollOrResize = () => hide()

        document.addEventListener("mouseover", onEnter)
        document.addEventListener("mouseout", onLeave)
        document.addEventListener("focusin", onEnter)
        document.addEventListener("focusout", onLeave)
        document.addEventListener("keydown", onKey, true)
        window.addEventListener("scroll", onScrollOrResize, true)
        window.addEventListener("resize", onScrollOrResize)
        return () => {
            clear()
            document.removeEventListener("mouseover", onEnter)
            document.removeEventListener("mouseout", onLeave)
            document.removeEventListener("focusin", onEnter)
            document.removeEventListener("focusout", onLeave)
            document.removeEventListener("keydown", onKey, true)
            window.removeEventListener("scroll", onScrollOrResize, true)
            window.removeEventListener("resize", onScrollOrResize)
        }
    }, [])

    if (!tip) return null

    // Mantém o balão dentro da janela na horizontal (o transform centraliza em x).
    const x = Math.min(Math.max(tip.x, 140), (typeof window !== "undefined" ? window.innerWidth : 1024) - 140)

    return createPortal(
        <div id={TOOLTIP_ID} role="tooltip"
            className={`mpm-tooltip mpm-tooltip--${tip.place}`}
            style={{ left: x, top: tip.y }}>
            <span className="mpm-tooltip__text">{tip.text}</span>
            {tip.shortcut ? <kbd className="mpm-tooltip__kbd">{tip.shortcut}</kbd> : null}
        </div>,
        document.body
    )
}

export default TooltipLayer
