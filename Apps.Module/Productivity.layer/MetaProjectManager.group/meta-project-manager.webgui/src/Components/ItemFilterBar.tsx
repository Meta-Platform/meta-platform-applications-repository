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

    return <div className="mpm-toolbar mpm-filterbar">
        <span className="mpm-row"><Icon name="filter" className="mpm-muted" />
            <input className="mpm-inline-select" style={{ minWidth: 140 }} placeholder="buscar texto..."
                value={sel("text")} onChange={(e) => setFilter("text", e.target.value)} /></span>

        <select className="mpm-inline-select" value={sel("type")} onChange={(e) => setFilter("type", e.target.value)}>
            <option value="">Tipo: todos</option>
            {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select className="mpm-inline-select" value={sel("priority")} onChange={(e) => setFilter("priority", e.target.value)}>
            <option value="">Prioridade: todas</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select className="mpm-inline-select" value={sel("horizon")} onChange={(e) => setFilter("horizon", e.target.value)}>
            <option value="">Horizonte: todos</option>
            {HORIZONS.map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
        </select>

        <select className="mpm-inline-select" value={sel("area")} onChange={(e) => setFilter("area", e.target.value)}>
            <option value="">Área: todas</option>
            {areaList.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select className="mpm-inline-select" value={sel("assignee")} onChange={(e) => setFilter("assignee", e.target.value)}>
            <option value="">Responsável: todos</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </select>

        <select className="mpm-inline-select" value={sel("milestone")} onChange={(e) => setFilter("milestone", e.target.value)}>
            <option value="">Milestone: todos</option>
            {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <select className="mpm-inline-select" value={sel("sprint")} onChange={(e) => setFilter("sprint", e.target.value)}>
            <option value="">Sprint: todos</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {showGroup && setGroup
            ? <select className="mpm-inline-select" value={group || "none"} onChange={(e) => setGroup(e.target.value as GroupBy)}>
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
