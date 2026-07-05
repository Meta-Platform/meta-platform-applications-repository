import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "semantic-ui-react"

// Menu de contexto (botão direito) posicionado em x,y. Fecha ao clicar fora,
// rolar ou pressionar Esc. Itens com `danger` ficam em vermelho; itens com
// `children` viram submenu expansível; `checked` mostra um "✓".
export type ContextMenuItem = {
    label: string
    icon?: string
    onClick?: () => void
    danger?: boolean
    disabled?: boolean
    divider?: boolean
    checked?: boolean
    children?: ContextMenuItem[]
}

type ContextMenuProps = {
    x: number
    y: number
    items: ContextMenuItem[]
    onClose: () => void
}

const ContextMenu = ({ x, y, items, onClose }:ContextMenuProps) => {

    const ref = useRef<HTMLDivElement>(null)
    const [ pos, setPos ] = useState({ x, y })
    const [ expandedIndex, setExpandedIndex ] = useState<number>()

    // Mantém o menu dentro da viewport.
    useEffect(() => {
        const el = ref.current
        if(!el) return
        const rect = el.getBoundingClientRect()
        const maxX = window.innerWidth - rect.width - 8
        const maxY = window.innerHeight - rect.height - 8
        setPos({ x: Math.min(x, maxX), y: Math.min(y, maxY) })
    }, [x, y, expandedIndex])

    useEffect(() => {
        const onKey = (e:KeyboardEvent) => { if(e.key === "Escape") onClose() }
        const onScroll = () => onClose()
        window.addEventListener("keydown", onKey)
        window.addEventListener("scroll", onScroll, true)
        return () => {
            window.removeEventListener("keydown", onKey)
            window.removeEventListener("scroll", onScroll, true)
        }
    }, [onClose])

    const _RenderLeaf = (item:ContextMenuItem, key:number, isChild:boolean) =>
        <button
            key={key}
            type="button"
            className={`myd-ctx-item ${isChild ? "myd-ctx-item--child" : ""} ${item.danger ? "myd-ctx-item--danger" : ""}`}
            disabled={item.disabled}
            onClick={() => { onClose(); item.onClick && item.onClick() }}>
            { item.checked
                ? <Icon name="check"/>
                : item.icon
                    ? <Icon name={item.icon as any}/>
                    : <span className="myd-ctx-icon-gap"/> }
            <span>{item.label}</span>
        </button>

    return <>
        <div className="myd-ctx-scrim" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}/>
        <div ref={ref} className="myd-ctx-menu" style={{ left: pos.x, top: pos.y }}>
            {
                items.map((item, key) => {
                    if(item.divider)
                        return <div key={key} className="myd-ctx-divider"/>

                    if(item.children && item.children.length > 0){
                        const isExpanded = expandedIndex === key
                        return <React.Fragment key={key}>
                            <button
                                type="button"
                                className={`myd-ctx-item ${isExpanded ? "myd-ctx-item--open" : ""}`}
                                disabled={item.disabled}
                                onClick={() => setExpandedIndex(isExpanded ? undefined : key)}>
                                { item.icon ? <Icon name={item.icon as any}/> : <span className="myd-ctx-icon-gap"/> }
                                <span>{item.label}</span>
                                <Icon name={isExpanded ? "angle down" : "angle right"} className="myd-ctx-chevron"/>
                            </button>
                            { isExpanded && item.children.map((child, childKey) => _RenderLeaf(child, childKey, true)) }
                        </React.Fragment>
                    }

                    return _RenderLeaf(item, key, false)
                })
            }
        </div>
    </>
}

export default ContextMenu
