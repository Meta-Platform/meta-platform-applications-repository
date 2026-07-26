import * as React from "react"
import { Icon } from "semantic-ui-react"

import { RuntimeItem } from "../../../Domain/packageModel"
import { IssueBadges } from "../ui/ValidationBadge"
import { Badge } from "../ui/Primitives"

// Lista compacta de recursos do runtime: uma linha por item, com o identificador
// em mono, o subtítulo técnico e os indicadores (contagens, avisos). Clicar abre
// o detalhe — a lista continua visível ao lado/atrás, sem perder o contexto.

export type Summary = { label: string, value: React.ReactNode }

type Props = {
    items       : RuntimeItem[]
    selectedId? : string
    onSelect    : (itemId:string) => void
    summarize?  : (item:RuntimeItem) => Summary[]
    emptyHint?  : string
}

const countOf = (item:RuntimeItem, group:string):number => {
    const g = item.groups.filter((x) => x.label === group)[0]
    return g ? g.entries.length : 0
}

export const defaultSummary = (item:RuntimeItem):Summary[] => {
    const out:Summary[] = []
    const params = countOf(item, "params")
    const bound  = countOf(item, "bound-params")
    if(params) out.push({ label: "params", value: params })
    if(bound)  out.push({ label: "bound", value: bound })
    if(item.refs.length) out.push({ label: "deps", value: item.refs.length })
    return out
}

const ItemList = ({ items, selectedId, onSelect, summarize, emptyHint }:Props) => {
    if(!items || !items.length) return null
    const summaryOf = summarize || defaultSummary
    return <div role="list">
        {
            items.map((item) => {
                const summaries = summaryOf(item)
                const selected = selectedId === item.id
                return <button key={item.id} type="button" role="listitem"
                    aria-selected={selected}
                    className="pdx-card pdx-card--clickable"
                    style={selected ? { borderColor: "var(--mp-accent-blue)", boxShadow: "inset 3px 0 0 var(--mp-accent-blue)" } : undefined}
                    onClick={() => onSelect(item.id)}>
                    <div className="pdx-card__head">
                        <Icon name={item.icon as any} style={{margin:0, color:"var(--mp-muted)"}} />
                        <span className="pdx-card__title">{item.title}</span>
                        <IssueBadges issues={item.issues} compact />
                    </div>
                    <div className="pdx-card__body" style={{paddingTop:6, paddingBottom:8}}>
                        { item.subtitle &&
                            <div className="pdx-mono" style={{fontSize:11, color:"var(--mp-muted)", wordBreak:"break-all"}}>
                                {item.subtitle}
                            </div> }
                        {
                            summaries.length > 0 &&
                            <div className="pdx-inline" style={{marginTop:6}}>
                                { summaries.map((s) => <Badge key={s.label}>{s.value} {s.label}</Badge>) }
                            </div>
                        }
                    </div>
                </button>
            })
        }
        { emptyHint && <div className="pdx-muted" style={{fontSize:12}}>{emptyHint}</div> }
    </div>
}

export default ItemList
