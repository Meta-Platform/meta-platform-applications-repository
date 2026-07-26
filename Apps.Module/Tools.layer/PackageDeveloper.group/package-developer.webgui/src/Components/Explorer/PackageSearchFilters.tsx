import * as React from "react"

import { CAPABILITY_LABELS, CapabilityFlag, Facets, Filters } from "../../Domain/packageIndex"
import { IconButton } from "./ui/Primitives"

// Filtros combináveis com contagem por faceta. Opção que não existe no conjunto
// atual não é renderizada — o painel só oferece o que dá resultado.

type Props = {
    filters : Filters
    facets  : Facets
    onChange: (filters:Filters) => void
}

const toggle = (list:string[], value:string):string[] =>
    list.indexOf(value) > -1 ? list.filter((v) => v !== value) : list.concat([value])

const Group = ({ label, values, selected, onToggle, labelOf }:any) => {
    if(!values || !values.length) return null
    return <div className="pdx-filters__group">
        <div className="pdx-filters__label">{label}</div>
        <div className="pdx-chips">
            {
                values.map((facet:any) =>
                    <button key={facet.value} type="button"
                        className={`pdx-chip${selected.indexOf(facet.value) > -1 ? " pdx-chip--on" : ""}`}
                        aria-pressed={selected.indexOf(facet.value) > -1}
                        onClick={() => onToggle(facet.value)}>
                        {labelOf ? labelOf(facet.value) : facet.value}
                        <span className="pdx-chip__count">{facet.count}</span>
                    </button>)
            }
        </div>
    </div>
}

const PackageSearchFilters = ({ filters, facets, onChange }:Props) =>
    <div className="pdx-filters">
        <Group label="tipo" values={facets.types} selected={filters.types}
            onToggle={(v:string) => onChange({ ...filters, types: toggle(filters.types, v) })} />
        <Group label="módulo" values={facets.modules} selected={filters.modules}
            onToggle={(v:string) => onChange({ ...filters, modules: toggle(filters.modules, v) })} />
        <Group label="layer" values={facets.layers} selected={filters.layers}
            onToggle={(v:string) => onChange({ ...filters, layers: toggle(filters.layers, v) })} />
        <Group label="capacidades" values={facets.capabilities} selected={filters.capabilities}
            labelOf={(v:CapabilityFlag) => CAPABILITY_LABELS[v]}
            onToggle={(v:CapabilityFlag) => onChange({ ...filters, capabilities: toggle(filters.capabilities, v) as CapabilityFlag[] })} />
    </div>

// Faixa com os filtros ATIVOS (sempre visível quando há filtro), com remoção
// individual e "limpar tudo".
export const ActiveFilters = ({ filters, onChange, resultCount }:any) => {
    const chips:{ label:string, remove:() => void }[] = []
    filters.types.forEach((v:string) => chips.push({ label: `tipo: ${v}`, remove: () => onChange({ ...filters, types: filters.types.filter((x:string) => x !== v) }) }))
    filters.modules.forEach((v:string) => chips.push({ label: `módulo: ${v}`, remove: () => onChange({ ...filters, modules: filters.modules.filter((x:string) => x !== v) }) }))
    filters.layers.forEach((v:string) => chips.push({ label: `layer: ${v}`, remove: () => onChange({ ...filters, layers: filters.layers.filter((x:string) => x !== v) }) }))
    filters.capabilities.forEach((v:CapabilityFlag) => chips.push({ label: CAPABILITY_LABELS[v], remove: () => onChange({ ...filters, capabilities: filters.capabilities.filter((x:string) => x !== v) }) }))
    if(filters.query.trim()) chips.push({ label: `“${filters.query.trim()}”`, remove: () => onChange({ ...filters, query: "" }) })
    if(!chips.length) return null

    return <div className="pdx-activefilters">
        <span className="pdx-mono" aria-live="polite">{resultCount} resultado(s)</span>
        {
            chips.map((chip, i) =>
                <button key={i} type="button" className="pdx-chip pdx-chip--on" onClick={chip.remove}
                    aria-label={`remover filtro ${chip.label}`}>
                    {chip.label} ✕
                </button>)
        }
        <IconButton icon="eraser" label="Limpar filtros" text="Limpar filtros" ghost
            onClick={() => onChange({ query: "", types: [], modules: [], layers: [], capabilities: [] })} />
    </div>
}

export default PackageSearchFilters
