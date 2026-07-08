import * as React from "react"
import { Icon } from "semantic-ui-react"

// Faixa de status/filtros (§8.2): chips de contador com padrão visual único.
// StatusChip pode ser estático (contador) ou clicável (filtro), com estado
// `active`. Design system: Meta System Retro-Brutalist UI.
const StatusStrip = ({ children, right }:any) =>
    <div className="mp-status-strip">
        <div className="mp-status-strip__chips">{children}</div>
        { right && <div className="mp-status-strip__right">{right}</div> }
    </div>

// tones: neutral | success | warning | danger | info
const StatusChip = ({ icon, label, count, tone = "neutral", active, onClick }:any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "span",
        {
            type: clickable ? "button" : undefined,
            className: `mp-status-chip mp-status-chip--${tone}${active ? " is-active" : ""}${clickable ? " is-clickable" : ""}`,
            onClick
        },
        <>
            { icon && <Icon name={icon} style={{ margin: 0 }}/> }
            { count !== undefined && <strong className="mp-status-chip__count">{count}</strong> }
            <span>{label}</span>
        </>
    )
}

export default StatusStrip
export { StatusChip }
