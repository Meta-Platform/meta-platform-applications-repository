import * as React from "react"
import { Icon } from "@i-components"

// Primitivos visuais do explorador. Todos usam as classes .pdx-* (explorer.css),
// que por sua vez leem os tokens --mp-* do design system — nada de cor solta.

export const Badge = ({ tone, icon, children, title, className }:any) =>
    <span className={`pdx-badge${tone ? ` pdx-badge--${tone}` : ""}${className ? ` ${className}` : ""}`} title={title}>
        { icon && <Icon name={icon} style={{margin:0}} /> }
        {children}
    </span>

export const Metric = ({ value, label, title }:any) =>
    <div className="pdx-metric" title={title}>
        <div className="pdx-metric__value">{value}</div>
        <div className="pdx-metric__label">{label}</div>
    </div>

export const Metrics = ({ items }:{ items:{ value:any, label:string, title?:string }[] }) => {
    const visible = (items || []).filter((m) => m && m.value !== undefined && m.value !== null && m.value !== 0)
    if(!visible.length) return null
    return <div className="pdx-metrics">
        { visible.map((m) => <Metric key={m.label} value={m.value} label={m.label} title={m.title} />) }
    </div>
}

// Estado vazio e mensagem em bloco vêm do kit (`EmptyState`, `Banner`) — não há
// duplicata local. `.pdx-alert` continua existindo só para a lista de problemas
// de validação (ValidationBadge), que é um bloco denso, não uma mensagem.

// Seção recolhível com contagem — não renderiza nada se não houver conteúdo.
export const CollapsibleSection = ({ id, title, count, icon, defaultOpen = true, children, right }:any) => {
    const [open, setOpen] = React.useState(defaultOpen)
    if(!children) return null
    return <section className="pdx-section">
        <button type="button" className="pdx-section__head" aria-expanded={open} aria-controls={`${id}-body`}
            onClick={() => setOpen(!open)}>
            <Icon name={open ? "caret down" : "caret right"} style={{margin:0, color:"var(--mp-muted)"}} />
            { icon && <Icon name={icon} style={{margin:0, color:"var(--mp-muted)"}} /> }
            <span className="pdx-section__title">{title}</span>
            { count != null && <span className="pdx-section__count">{count}</span> }
            { right }
        </button>
        { open && <div className="pdx-section__body" id={`${id}-body`}>{children}</div> }
    </section>
}

export const Card = ({ title, icon, right, children, onClick, selected }:any) => {
    const Tag:any = onClick ? "button" : "div"
    return <Tag type={onClick ? "button" : undefined}
        className={`pdx-card${onClick ? " pdx-card--clickable" : ""}`}
        aria-selected={selected}
        onClick={onClick}>
        { title != null &&
            <div className="pdx-card__head">
                { icon && <Icon name={icon} style={{margin:0, color:"var(--mp-muted)"}} /> }
                <span className="pdx-card__title">{title}</span>
                { right }
            </div> }
        { children != null && <div className="pdx-card__body">{children}</div> }
    </Tag>
}

export const Segmented = ({ value, options, onChange, ariaLabel }:any) =>
    <div className="pdx-segmented" role="group" aria-label={ariaLabel}>
        { options.map((o:any) =>
            <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
                { o.icon && <Icon name={o.icon} style={{margin:"0 4px 0 0"}} /> }
                {o.label}
            </button>) }
    </div>

// `label` é sempre o nome acessível; o texto só aparece com `text` — botões de
// barra ficam compactos sem perder rótulo para leitor de tela.
export const IconButton = ({ icon, label, text, onClick, active, ghost, title, disabled }:any) =>
    <button type="button" disabled={disabled} title={title || label} aria-label={label}
        className={`pdx-iconbtn${active ? " pdx-iconbtn--active" : ""}${ghost ? " pdx-iconbtn--ghost" : ""}`}
        onClick={onClick}>
        { icon && <Icon name={icon} style={{margin:0}} /> }
        { text && <span>{text}</span> }
    </button>
