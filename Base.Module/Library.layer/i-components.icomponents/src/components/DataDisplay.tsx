import * as React from "react"
import Icon from "./Icon"
import { EmptyState } from "./Feedback"

// Exibição de dados (§9, §11.2): painel, tabela, lista, árvore, cartão de
// objeto, tile de contagem e lista chave/valor. São os padrões que os WebGui
// reimplementavam com <Table>/<List>/<Segment> do Semantic + CSS local.

// Painel com cabeçalho e corpo — a moldura de qualquer seção de conteúdo.
export const Panel = ({ title, icon, actions, footer, children, className = "" }: any) =>
    <section className={`mp-ov-panel ${className}`.trim()}>
        { (title || actions) &&
            <header className="mp-ov-panel__head">
                <span className="mp-panel__title">
                    { icon && <Icon name={icon}/> }
                    {title}
                </span>
                { actions && <span className="mp-panel__actions">{actions}</span> }
            </header> }
        <div className="mp-ov-panel__body">{children}</div>
        { footer && <footer className="mp-panel__foot">{footer}</footer> }
    </section>

// Linha de lista clicável (usa .mp-ov-row do CSS comum).
export const ListRow = ({ icon, title, meta, right, selected, onClick, className = "" }: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            onClick,
            className: [
                "mp-ov-row",
                selected ? "is-selected" : "",
                clickable ? "is-clickable" : "",
                className
            ].filter(Boolean).join(" ")
        },
        <>
            { icon && <span className="mp-row__icon"><Icon name={icon}/></span> }
            <span className="mp-row__body">
                <span className="mp-row__title">{title}</span>
                { meta && <span className="mp-row__meta">{meta}</span> }
            </span>
            { right && <span className="mp-row__right">{right}</span> }
        </>
    )
}

// Tabela de dados dirigida por DADOS:
//   columns: [{ key, header, width, align, mono, render(row) }]
//   rows:    qualquer objeto; `rowKey` extrai a chave estável.
export type DataColumn = {
    key: string
    header: string
    width?: number | string
    align?: "left" | "right" | "center"
    mono?: boolean
    render?: (row: any) => React.ReactNode
}

export const DataTable = ({
    columns = [],
    rows = [],
    rowKey,
    onRowClick,
    selectedKey,
    dense = false,
    emptyMessage = "Nenhum registro.",
    className = ""
}: {
    columns?: DataColumn[]
    rows?: any[]
    rowKey?: (row: any, index: number) => string
    onRowClick?: (row: any) => void
    selectedKey?: string
    dense?: boolean
    emptyMessage?: string
    className?: string
}) => {
    if(!rows.length) return <EmptyState icon="table" message={emptyMessage}/>
    const KeyOf = (row: any, index: number) => rowKey ? rowKey(row, index) : String(index)
    return <div className={`mp-table-wrap ${className}`.trim()}>
        <table className={`mp-table ${dense ? "is-dense" : ""}`.trim()}>
            <thead>
                <tr>
                    { columns.map((column) =>
                        <th
                            key={column.key}
                            style={{ width: column.width, textAlign: column.align || "left" }}>
                            {column.header}
                        </th>) }
                </tr>
            </thead>
            <tbody>
                { rows.map((row, index) => {
                    const key = KeyOf(row, index)
                    return <tr
                        key={key}
                        className={[
                            onRowClick ? "is-clickable" : "",
                            selectedKey === key ? "is-selected" : ""
                        ].filter(Boolean).join(" ")}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}>
                        { columns.map((column) =>
                            <td
                                key={column.key}
                                className={column.mono ? "is-mono" : undefined}
                                style={{ textAlign: column.align || "left" }}>
                                { column.render ? column.render(row) : row[column.key] }
                            </td>) }
                    </tr>
                }) }
            </tbody>
        </table>
    </div>
}

// Linha de árvore (explorador de pacotes, estrutura de repositório, boot).
export const TreeRow = ({
    label,
    icon,
    depth = 0,
    expanded,
    hasChildren = false,
    selected = false,
    dirty = false,
    meta,
    onToggle,
    onSelect,
    className = ""
}: any) =>
    <div
        className={[
            "mp-tree-row",
            selected ? "is-selected" : "",
            dirty ? "is-dirty" : "",
            className
        ].filter(Boolean).join(" ")}
        style={{ paddingLeft: 8 + depth * 14 }}
        role="treeitem"
        aria-expanded={hasChildren ? Boolean(expanded) : undefined}>
        { hasChildren
            ? <button
                type="button"
                className="mp-tree-row__twisty"
                aria-label={expanded ? "recolher" : "expandir"}
                onClick={(event) => { event.stopPropagation(); onToggle && onToggle() }}>
                <Icon name={expanded ? "caret down" : "caret right"}/>
            </button>
            : <span className="mp-tree-row__twisty is-empty"/> }
        <button type="button" className="mp-tree-row__main" onClick={onSelect}>
            { icon && <Icon name={icon} className="mp-tree-row__icon"/> }
            <span className="mp-tree-row__label">{label}</span>
            { meta && <span className="mp-tree-row__meta">{meta}</span> }
        </button>
    </div>

// Cartão de objeto (§9.3) — pacote, instância, repositório, projeto.
export const ObjectCard = ({
    icon,
    iconNode,
    title,
    meta,
    status,
    chips,
    right,
    selected = false,
    dim = false,
    onClick,
    className = ""
}: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            onClick,
            className: [
                "mp-object-card",
                clickable ? "is-clickable" : "",
                selected ? "is-selected" : "",
                dim ? "is-dim" : "",
                className
            ].filter(Boolean).join(" ")
        },
        <>
            <span className="mp-object-card__icon">{ iconNode || <Icon name={icon || "cube"}/> }</span>
            <span className="mp-object-card__title" title={typeof title === "string" ? title : undefined}>{title}</span>
            { status && <span className="mp-object-card__status">{status}</span> }
            { meta && <span className="mp-object-card__meta">{meta}</span> }
            { (chips || right) &&
                <span className="mp-object-card__foot">
                    <span className="mp-object-card__chips">{chips}</span>
                    {right}
                </span> }
        </>
    )
}

// Tile de contagem (faixa de indicadores do topo das telas de operação).
export const Tile = ({ icon, count, title, sub, subTone = "muted", onClick, className = "" }: any) => {
    const clickable = typeof onClick === "function"
    return React.createElement(
        clickable ? "button" : "div",
        {
            type: clickable ? "button" : undefined,
            onClick,
            className: `mp-tile ${className}`.trim()
        },
        <>
            { icon && <span className="mp-tile__icon"><Icon name={icon}/></span> }
            <span className="mp-tile__body">
                <span className="mp-tile__count">{count}</span>
                <span className="mp-tile__title">{title}</span>
                { sub && <span className={`mp-tile__sub mp-tile__sub--${subTone}`}>{sub}</span> }
            </span>
            { clickable && <Icon name="chevron right" className="mp-tile__arrow"/> }
        </>
    )
}

export const TileRow = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) =>
    <div className={`mp-ov-tiles ${className}`.trim()} {...props}/>

// Lista chave/valor para dados técnicos (metadados de pacote, params, boot).
// items: [{ label, value, mono }]
export const KeyValueList = ({ items = [], columns = 1, className = "" }: any) =>
    <dl className={`mp-kv mp-kv--cols-${columns} ${className}`.trim()}>
        { items.filter((item: any) => item && item.value !== undefined && item.value !== null)
            .map((item: any, index: number) =>
                <div className="mp-kv__pair" key={index}>
                    <dt className="mp-kv__label">{item.label}</dt>
                    <dd className={`mp-kv__value ${item.mono ? "is-mono" : ""}`.trim()}>{item.value}</dd>
                </div>) }
    </dl>

// Abas de navegação dentro de uma tela.
// tabs: [{ key, label, icon, count, disabled }]
export const Tabs = ({ tabs = [], activeKey, onChange, className = "" }: any) =>
    <div className={`mp-tabs ${className}`.trim()} role="tablist">
        { tabs.map((tab: any) =>
            <button
                type="button"
                role="tab"
                key={tab.key}
                disabled={tab.disabled}
                aria-selected={tab.key === activeKey}
                className={`mp-tabs__tab ${tab.key === activeKey ? "is-active" : ""}`.trim()}
                onClick={() => onChange && onChange(tab.key)}>
                { tab.icon && <Icon name={tab.icon}/> }
                <span>{tab.label}</span>
                { tab.count !== undefined && <span className="mp-tabs__count">{tab.count}</span> }
            </button>) }
    </div>

// Bloco de código/saída técnica em monoespaçada (logs curtos, JSON, comando).
export const CodeBlock = ({ children, language, className = "" }: any) =>
    <pre className={`mp-code ${className}`.trim()} data-language={language}>
        <code>{children}</code>
    </pre>
