import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@i-components"

// Menu de contexto (botão direito) posicionado em x,y. Fecha ao clicar fora,
// rolar ou pressionar Esc. Itens com `danger` ficam em vermelho; itens com
// `children` viram submenu expansível; `checked` mostra um "✓".
//
// A caixa e os itens são os do kit (`.mp-menu*`, iguais aos do ContextMenu de
// @i-components). O que fica aqui é só o que o kit não tem e a área de trabalho
// precisa: submenu expansível em linha, marca de seleção e recorte na viewport.
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
            role="menuitem"
            className={`mp-menu__item ${isChild ? "myd-ctx-item--child" : ""} ${item.danger ? "is-danger" : ""}`}
            disabled={item.disabled}
            onClick={() => { onClose(); item.onClick && item.onClick() }}>
            { item.checked
                ? <Icon name="check" tone="info"/>
                : item.icon
                    ? <Icon name={item.icon}/>
                    : <span className="myd-ctx-icon-gap"/> }
            <span className="mp-menu__label">{item.label}</span>
        </button>

    return <>
        <div className="mp-menu__scrim" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}/>
        <div ref={ref} className="mp-menu-anchor" style={{ left: pos.x, top: pos.y }}>
            <div className="mp-menu" role="menu">
                {
                    items.map((item, key) => {
                        if(item.divider)
                            return <span key={key} className="mp-menu__sep" aria-hidden="true"/>

                        if(item.children && item.children.length > 0){
                            const isExpanded = expandedIndex === key
                            return <React.Fragment key={key}>
                                <button
                                    type="button"
                                    role="menuitem"
                                    aria-expanded={isExpanded}
                                    className={`mp-menu__item ${isExpanded ? "myd-ctx-item--open" : ""}`}
                                    disabled={item.disabled}
                                    onClick={() => setExpandedIndex(isExpanded ? undefined : key)}>
                                    { item.icon ? <Icon name={item.icon}/> : <span className="myd-ctx-icon-gap"/> }
                                    <span className="mp-menu__label">{item.label}</span>
                                    <Icon name={isExpanded ? "angle down" : "angle right"} tone="muted"/>
                                </button>
                                {
                                    isExpanded && item.children.map((child, childKey) =>
                                        child.divider
                                            ? <span key={childKey} className="mp-menu__sep" aria-hidden="true"/>
                                            : _RenderLeaf(child, childKey, true))
                                }
                            </React.Fragment>
                        }

                        return _RenderLeaf(item, key, false)
                    })
                }
            </div>
        </div>
    </>
}

export default ContextMenu
