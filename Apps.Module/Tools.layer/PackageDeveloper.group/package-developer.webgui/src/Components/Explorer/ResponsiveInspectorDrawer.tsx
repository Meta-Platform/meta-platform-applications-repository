import * as React from "react"
import { useEffect, useRef } from "react"
import { Icon } from "semantic-ui-react"

// Inspector sobreposto (larguras média e estreita): painel vindo da direita, com
// superfície própria, sombra e scrim. Fecha no botão e no Esc; o foco entra no
// painel e volta para quem o abriu. A navegação por baixo NÃO é remontada — a
// seleção e o scroll continuam onde estavam.

type Props = {
    open      : boolean
    full?     : boolean
    title     : string
    onClose   : () => void
    children  : React.ReactNode
}

const ResponsiveInspectorDrawer = ({ open, full, title, onClose, children }:Props) => {

    const panelRef = useRef<HTMLDivElement>(null)
    const restoreRef = useRef<any>(null)

    useEffect(() => {
        if(!open) return
        restoreRef.current = document.activeElement
        const onKey = (e:KeyboardEvent) => { if(e.key === "Escape"){ e.stopPropagation(); onClose() } }
        document.addEventListener("keydown", onKey)
        if(panelRef.current) panelRef.current.focus()
        return () => {
            document.removeEventListener("keydown", onKey)
            const previous = restoreRef.current
            if(previous && previous.focus) previous.focus()
        }
    }, [open])

    if(!open) return null

    return <>
        <div className="pdx-drawer-scrim" onClick={onClose} aria-hidden="true" />
        <div className={`pdx-drawer${full ? " pdx-drawer--full" : ""}`}
            role="dialog" aria-modal="true" aria-label={title}
            tabIndex={-1} ref={panelRef}>
            <div className="pdx-drawer__bar">
                <Icon name="info circle" style={{margin:0, color:"var(--mp-muted)"}} />
                <span className="pdx-drawer__title">{title}</span>
                <button type="button" className="pdx-iconbtn pdx-iconbtn--ghost" onClick={onClose}
                    aria-label="Fechar inspector (Esc)" title="Fechar (Esc)">
                    <Icon name="times" style={{margin:0}} />
                </button>
            </div>
            <div style={{flex:"1 1 auto", minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden"}}>
                {children}
            </div>
        </div>
    </>
}

export default ResponsiveInspectorDrawer
