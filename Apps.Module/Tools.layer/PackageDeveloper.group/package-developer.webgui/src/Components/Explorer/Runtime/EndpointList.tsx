import * as React from "react"
import { useMemo, useState } from "react"
import { Icon } from "semantic-ui-react"

import { RuntimeItem } from "../../../Domain/packageModel"
import { Badge, EmptyState, IconButton, Segmented } from "../ui/Primitives"

// Endpoints como TABELA pesquisável: rota, tipo, controller e template de API em
// colunas — comparar rotas é o que se faz aqui, e cartão empilhado não compara.
// O método HTTP vive no api.json de cada controller (outro arquivo, não carregado
// nesta tela): não há badge de método porque o dado não existe aqui.

type Props = {
    items       : RuntimeItem[]
    selectedId? : string
    onSelect    : (id:string) => void
}

type SortKey = "url" | "controller" | "type"

const paramOf = (item:RuntimeItem, key:string):string | undefined => {
    const params = (item.raw && item.raw.params) || {}
    return params[key]
}

// "Controllers/Configurations.controller" → "Configurations" (o caminho inteiro
// fica no title; a coluna precisa comparar, não repetir prefixo).
const shortName = (value?:string):string => {
    if(!value) return ""
    const last = value.split("/").pop() || value
    return last.replace(/\.(controller|api)(\.json)?$/, "")
}

const EndpointList = ({ items, selectedId, onSelect }:Props) => {

    const [query, setQuery] = useState("")
    const [sort, setSort]   = useState<SortKey>("url")
    const [grouped, setGrouped] = useState(false)

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase()
        const match = (item:RuntimeItem) => {
            if(!q) return true
            const haystack = [item.title, item.subtitle, paramOf(item, "controller"), paramOf(item, "api-template"), item.raw && item.raw.type]
                .filter(Boolean).join(" ").toLowerCase()
            return haystack.indexOf(q) > -1
        }
        const value = (item:RuntimeItem):string =>
            sort === "controller" ? String(paramOf(item, "controller") || "") :
            sort === "type"       ? String((item.raw && item.raw.type) || "") :
                                    item.title
        return items.filter(match).sort((a, b) => value(a).localeCompare(value(b)))
    }, [items, query, sort])

    const groups = useMemo(() => {
        if(!grouped) return [{ key: "", items: rows }]
        const map:{[k:string]:RuntimeItem[]} = {}
        rows.forEach((item) => {
            const key = String(paramOf(item, "controller") || item.raw && item.raw.type || "—")
            map[key] = (map[key] || []).concat([item])
        })
        return Object.keys(map).sort().map((key) => ({ key, items: map[key] }))
    }, [rows, grouped])

    return <div>
        <div className="pdx-inline" style={{marginBottom:10}}>
            <div className="pdx-search__field" style={{maxWidth:280}}>
                <Icon name="search" style={{margin:0, color:"var(--mp-muted)"}} />
                <input value={query} placeholder="Filtrar rota, controller ou tipo…"
                    aria-label="Filtrar endpoints"
                    onChange={(e:any) => setQuery(e.target.value)} />
                { query && <IconButton icon="times" label="limpar filtro de endpoints" ghost onClick={() => setQuery("")} /> }
            </div>
            <Segmented ariaLabel="Ordenar endpoints" value={sort} onChange={setSort} options={[
                { value: "url", label: "rota" },
                { value: "controller", label: "controller" },
                { value: "type", label: "tipo" }
            ]} />
            <IconButton icon="sitemap" label="Agrupar por controller" text="agrupar" active={grouped}
                title="Agrupar por controller" onClick={() => setGrouped(!grouped)} />
            <span className="pdx-muted" style={{fontSize:11, marginLeft:"auto"}} aria-live="polite">
                {rows.length} de {items.length}
            </span>
        </div>

        {
            rows.length === 0
            ? <EmptyState icon="search" title="Nenhum endpoint corresponde"
                hint={`Nada casa com “${query}”.`}
                action={<IconButton icon="times" label="Limpar filtro" text="Limpar filtro" onClick={() => setQuery("")} />} />
            : groups.map((group) =>
                <div key={group.key || "all"} style={{marginBottom: grouped ? 14 : 0}}>
                    { grouped &&
                        <div className="pdx-props__label" style={{marginBottom:4}}>{group.key}</div> }
                    <div className="pdx-tablewrap">
                        <table className="pdx-table">
                            <thead>
                                <tr>
                                    <th>rota</th>
                                    <th>controller</th>
                                    <th>tipo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    group.items.map((item) => {
                                        const controller = paramOf(item, "controller")
                                        const template = paramOf(item, "api-template")
                                        return <tr key={item.id} aria-selected={selectedId === item.id}
                                            tabIndex={0}
                                            onClick={() => onSelect(item.id)}
                                            onKeyDown={(e:any) => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onSelect(item.id) } }}>
                                            <td className="pdx-route" title={item.title}>{item.title}</td>
                                            <td title={[controller, template].filter(Boolean).join("\n")}>
                                                <span className="pdx-mono">{shortName(controller)}</span>
                                                { template &&
                                                    <span className="pdx-muted" style={{fontSize:11, display:"block"}}>
                                                        {shortName(template)}.api
                                                    </span> }
                                            </td>
                                            <td>
                                                { item.raw && item.raw.type &&
                                                    <Badge>{item.raw.type}</Badge> }
                                            </td>
                                        </tr>
                                    })
                                }
                            </tbody>
                        </table>
                    </div>
                </div>)
        }
    </div>
}

export default EndpointList
