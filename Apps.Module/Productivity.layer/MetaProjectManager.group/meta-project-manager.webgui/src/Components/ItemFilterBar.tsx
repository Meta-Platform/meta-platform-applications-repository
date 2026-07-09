import * as React from "react"
import { Icon } from "semantic-ui-react"

import { ListItemsQuery } from "../api/items"
import {
    User, Milestone, Sprint,
    WORK_ITEM_TYPES, HORIZONS, AREA_SUGGESTIONS
} from "../api/types"
import { horizonLabel } from "../Utils/format"
import { GroupBy } from "../Hooks/useItemFilters"

const PRIORITIES = ["urgent", "high", "medium", "low", "none"]

const GROUPS: { key: GroupBy; label: string }[] = [
    { key: "none", label: "Sem agrupamento" },
    { key: "horizon", label: "Por horizonte" },
    { key: "parent", label: "Por epic/feature" },
    { key: "area", label: "Por área" },
    { key: "sprint", label: "Por sprint" }
]

interface ItemFilterBarProps {
    filters: ListItemsQuery
    setFilter: (name: keyof ListItemsQuery, value: string) => void
    group?: GroupBy
    setGroup?: (g: GroupBy) => void
    reset: () => void
    activeCount: number
    users: User[]
    milestones: Milestone[]
    sprints: Sprint[]
    areas?: string[]
    showGroup?: boolean
}

// Barra de filtros/agrupamento reutilizável (Board, Lista, Backlog). Emite
// alterações no ListItemsQuery persistido por useItemFilters.
const ItemFilterBar = ({ filters, setFilter, group, setGroup, reset, activeCount,
    users, milestones, sprints, areas, showGroup }: ItemFilterBarProps) => {

    const areaList = (areas && areas.length > 0) ? areas : AREA_SUGGESTIONS
    const sel = (name: keyof ListItemsQuery) => (filters as any)[name] || ""

    // Cada filtro é um select-pill; quando tem valor, ganha destaque (is-set).
    const pill = (name: keyof ListItemsQuery, allLabel: string, options: { value: string; label: string }[]) =>
        <select className={`mpm-inline-select ${sel(name) ? "is-set" : ""}`} title={allLabel}
            value={sel(name)} onChange={(e) => setFilter(name, e.target.value)}>
            <option value="">{allLabel}</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

    const plain = (values: string[]) => values.map((v) => ({ value: v, label: v }))

    return <div className="mpm-filterbar">
        <span className="mpm-filterbar__search">
            <Icon name="search" className="mpm-muted" />
            <input className="mpm-inline-select" placeholder="buscar texto..."
                value={sel("text")} onChange={(e) => setFilter("text", e.target.value)} />
        </span>

        {pill("type", "Tipo", plain(WORK_ITEM_TYPES as any))}
        {pill("priority", "Prioridade", plain(PRIORITIES))}
        {pill("horizon", "Horizonte", (HORIZONS as any as string[]).map((h) => ({ value: h, label: horizonLabel(h as any) })))}
        {pill("area", "Área", plain(areaList))}
        {pill("assignee", "Responsável", users.map((u) => ({ value: u.id, label: u.displayName })))}
        {pill("milestone", "Entrega", milestones.map((m) => ({ value: m.id, label: m.name })))}
        {pill("sprint", "Sprint", sprints.map((s) => ({ value: s.id, label: s.name })))}

        {showGroup && setGroup
            ? <select className={`mpm-inline-select ${group && group !== "none" ? "is-set" : ""}`}
                title="Agrupamento da lista"
                value={group || "none"} onChange={(e) => setGroup(e.target.value as GroupBy)}>
                {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            : null}

        <span className="mpm-toolbar__spacer" />
        {activeCount > 0
            ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={reset}>
                <Icon name="close" /> Limpar ({activeCount})
            </button>
            : null}
    </div>
}

export default ItemFilterBar
