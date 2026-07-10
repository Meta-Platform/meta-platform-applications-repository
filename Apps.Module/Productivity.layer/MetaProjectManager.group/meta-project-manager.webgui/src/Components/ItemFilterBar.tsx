import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import { ListItemsQuery } from "../api/items"
import {
    User, Milestone, Sprint,
    WORK_ITEM_TYPES, HORIZONS, AREA_SUGGESTIONS
} from "../api/types"
import { horizonLabel } from "../Utils/format"
import { typeLabel, priorityLabel } from "../Utils/labels"
import { GroupBy } from "../Hooks/useItemFilters"
import useApi from "../Hooks/useApi"
import { EcosystemPackage } from "../api/types"

const PRIORITIES = ["urgent", "high", "medium", "low", "none"]

const GROUPS: { key: GroupBy; label: string }[] = [
    { key: "none", label: "Sem agrupamento" },
    { key: "horizon", label: "Por horizonte" },
    { key: "parent", label: "Por épico/funcionalidade" },
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

    const api = useApi()
    // Pacotes do ecossistema que aparecem no filtro. Só os que existem de verdade.
    const [packages, setPackages] = useState<EcosystemPackage[]>([])
    useEffect(() => {
        api.ecosystem.listPackages({ limit: "200" })
            .then((l) => setPackages(l || []))
            .catch(() => setPackages([]))
    }, [api])

    const areaList = (areas && areas.length > 0) ? areas : AREA_SUGGESTIONS
    const sel = (name: keyof ListItemsQuery) => (filters as any)[name] || ""

    // Cada filtro é um select-pill; quando tem valor, ganha destaque (is-set).
    //
    // O rótulo de cada opção leva o nome do filtro ("Tipo: bug") porque um select
    // fechado mostra o texto da opção escolhida: sem o prefixo, o pill viraria só
    // "bug" e ninguém saberia de qual filtro ele é.
    const pill = (name: keyof ListItemsQuery, allLabel: string, options: { value: string; label: string }[]) => {
        const current = sel(name)
        return <select className={`mpm-inline-select ${current ? "is-set" : ""}`}
            title={current ? `${allLabel}: ${current}` : allLabel}
            value={current} onChange={(e) => setFilter(name, e.target.value)}>
            <option value="">{allLabel}: todos</option>
            {options.map((o) =>
                <option key={o.value} value={o.value}>{allLabel}: {o.label}</option>)}
        </select>
    }

    // O valor vai cru para a API; o humano lê em português.
    const labeled = (values: string[], label: (v: string) => string) =>
        values.map((v) => ({ value: v, label: label(v) }))

    return <div className="mpm-filterbar">
        <div className="mpm-filterbar__scroll">
        <span className="mpm-filterbar__search">
            <Icon name="search" className="mpm-muted" />
            <input placeholder="buscar texto..."
                value={sel("text")} onChange={(e) => setFilter("text", e.target.value)} />
        </span>

        {pill("type", "Tipo", labeled(WORK_ITEM_TYPES as any, typeLabel))}
        {pill("priority", "Prioridade", labeled(PRIORITIES, priorityLabel))}
        {pill("horizon", "Horizonte", (HORIZONS as any as string[]).map((h) => ({ value: h, label: horizonLabel(h as any) })))}
        {pill("area", "Área", areaList.map((a) => ({ value: a, label: a })))}
        {pill("assignee", "Responsável", users.map((u) => ({ value: u.id, label: u.displayName })))}
        {pill("milestone", "Entrega", milestones.map((m) => ({ value: m.id, label: m.name })))}
        {pill("sprint", "Sprint", sprints.map((s) => ({ value: s.id, label: s.name })))}
        {packages.length > 0
            ? pill("package", "Pacote", packages.map((p) => ({
                value: p.ref,
                // o mesmo nome pode existir em repositórios diferentes
                label: `${p.packageName} (${p.groupName || p.layerName})`
            })))
            : null}

        {showGroup && setGroup
            ? <select className={`mpm-inline-select ${group && group !== "none" ? "is-set" : ""}`}
                title="Agrupamento da lista"
                value={group || "none"} onChange={(e) => setGroup(e.target.value as GroupBy)}>
                {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            : null}

        </div>

        <div className="mpm-filterbar__actions">
            {activeCount > 0
                ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={reset}
                    title="Remover todos os filtros aplicados">
                    <Icon name="close" /> Limpar ({activeCount})
                </button>
                : null}
        </div>
    </div>
}

export default ItemFilterBar
