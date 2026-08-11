import * as React from "react"
import { Icon } from "@i-components"

// Linha de árvore com a REGRA de interação do explorador:
//   · o chevron (twisty) SÓ expande/recolhe;
//   · clicar na linha SÓ seleciona;
//   · a seleção tem faixa + fundo + peso próprios, distintos de hover e foco.
// Semântica ARIA de treeitem fica aqui, não espalhada pelos consumidores.

type Props = {
    label       : React.ReactNode
    icon?       : React.ReactNode
    level?      : number
    expandable? : boolean
    expanded?   : boolean
    selected?   : boolean
    meta?       : React.ReactNode
    action?     : React.ReactNode      // ação da linha (ex.: favoritar)
    sub?        : React.ReactNode
    title?      : string
    onToggle?   : () => void
    onSelect?   : () => void
    onContextMenu? : (e:any) => void
    onDoubleClick? : () => void
    rowRef?     : any
    tabIndex?   : number
    onKeyDown?  : (e:any) => void
    children?   : React.ReactNode
}

const TreeRow = ({
    label, icon, level = 0, expandable, expanded, selected, meta, action, sub, title,
    onToggle, onSelect, onContextMenu, onDoubleClick, rowRef, tabIndex, onKeyDown, children
}:Props) =>
    <li role="none" style={{listStyle:"none"}}>
        <div role="treeitem"
            ref={rowRef}
            aria-expanded={expandable ? !!expanded : undefined}
            aria-selected={!!selected}
            aria-level={level + 1}
            tabIndex={tabIndex}
            title={title}
            className={`pdx-row${selected ? " pdx-row--selected" : ""}${sub ? " pdx-row--twoline" : ""}`}
            style={{ paddingLeft: 4 + level * 12 }}
            onKeyDown={onKeyDown}
            onClick={(e:any) => { e.stopPropagation(); onSelect && onSelect() }}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}>
            <span
                role="button"
                aria-hidden={!expandable}
                tabIndex={-1}
                className={`pdx-row__twisty${expandable ? "" : " pdx-row__twisty--leaf"}`}
                aria-label={expanded ? "recolher" : "expandir"}
                onClick={(e:any) => { e.stopPropagation(); if(expandable && onToggle) onToggle() }}>
                <Icon name={expanded ? "caret down" : "caret right"} style={{margin:0}} />
            </span>
            { icon && <span className="pdx-row__icon">{icon}</span> }
            <span className="pdx-row__label">
                {label}
                { sub && <span className="pdx-row__sub">{sub}</span> }
            </span>
            { meta && <span className="pdx-row__meta">{meta}</span> }
            { action && <span className="pdx-row__action">{action}</span> }
        </div>
        { expandable && expanded && children }
    </li>

export default TreeRow
