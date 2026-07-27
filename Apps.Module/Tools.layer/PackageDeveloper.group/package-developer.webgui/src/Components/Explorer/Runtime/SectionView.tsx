import * as React from "react"
import { useMemo, useState } from "react"
import { Icon } from "semantic-ui-react"

import { RuntimeItem, RuntimeSection } from "../../../Domain/packageModel"
import StructureTree from "./StructureTree"
import { EmptyState, IconButton, Segmented } from "../ui/Primitives"

// A seção na visão ESTRUTURA: barra de trabalho (filtrar, ordenar, abrir/fechar
// tudo) + a árvore de detalhes. Uma seção com dezenas de rotas precisa de filtro
// e ordenação; uma com dois serviços não precisa de nada disso — por isso a
// barra só aparece a partir de um punhado de itens.

const TOOLBAR_FROM = 5

type Props = {
    section     : RuntimeSection
    selectedId? : string
    onSelect    : (itemId:string) => void
    onOpenRef?  : (target:string) => void
    workspace?  : string
    pkg?        : { name:string, ext:string }
}

type SortKey = "declared" | "name" | "sub"

const SORT_LABEL:any = { declared: "declaração", name: "nome", sub: "implementação" }

// Texto pesquisável de um item: título, subtítulo e os valores das propriedades.
const haystack = (item:RuntimeItem):string => {
    const parts:string[] = [item.title, item.subtitle || ""]
    item.groups.forEach((g) => g.entries.forEach((e) => parts.push(e.label, e.value)))
    return parts.join(" ").toLowerCase()
}

const SectionView = ({ section, selectedId, onSelect, onOpenRef, workspace, pkg }:Props) => {

    const [query, setQuery] = useState("")
    const [sort, setSort]   = useState<SortKey>("declared")
    const [openAll, setOpenAll] = useState(0)   // muda a chave para reabrir/fechar tudo

    const items = useMemo(() => {
        const q = query.trim().toLowerCase()
        const filtered = q ? section.items.filter((item) => haystack(item).indexOf(q) > -1) : section.items
        if(sort === "declared") return filtered
        const value = (item:RuntimeItem) => sort === "name" ? item.title : (item.subtitle || "")
        return filtered.slice().sort((a, b) => value(a).localeCompare(value(b)))
    }, [section.items, query, sort])

    const showToolbar = section.items.length >= TOOLBAR_FROM

    return <div>
        {
            showToolbar &&
            <div className="pdx-inline" style={{marginBottom:10}}>
                <div className="pdx-search__field" style={{maxWidth:260}}>
                    <Icon name="filter" style={{margin:0, color:"var(--mp-muted)"}} />
                    <input value={query} placeholder={`Filtrar ${section.title.toLowerCase()}…`}
                        aria-label={`Filtrar ${section.title}`}
                        onChange={(e:any) => setQuery(e.target.value)} />
                    { query && <IconButton icon="times" label="Limpar filtro" ghost onClick={() => setQuery("")} /> }
                </div>
                <Segmented ariaLabel="Ordenar" value={sort} onChange={setSort} options={[
                    { value: "declared", label: SORT_LABEL.declared },
                    { value: "name",     label: SORT_LABEL.name },
                    { value: "sub",      label: SORT_LABEL.sub }
                ]} />
                <IconButton icon="expand" label="Expandir tudo" onClick={() => setOpenAll(openAll + 1)} />
                <IconButton icon="compress" label="Recolher tudo" onClick={() => setOpenAll(-(Math.abs(openAll) + 1))} />
                <span className="pdx-muted" style={{fontSize:11, marginLeft:"auto"}} aria-live="polite">
                    {items.length}{items.length !== section.items.length ? ` de ${section.items.length}` : ""}
                </span>
            </div>
        }

        {
            items.length === 0
            ? <EmptyState icon="search" title="Nada corresponde ao filtro"
                hint={`Nenhum item de ${section.title.toLowerCase()} casa com “${query.trim()}”.`}
                action={<IconButton icon="times" label="Limpar filtro" text="Limpar filtro" onClick={() => setQuery("")} />} />
            : <StructureTree key={`${section.id}:${openAll}`} items={items} selectedId={selectedId}
                onSelect={onSelect} onOpenRef={onOpenRef} workspace={workspace} pkg={pkg}
                forceOpen={openAll > 0 ? true : openAll < 0 ? false : undefined} />
        }
    </div>
}

export default SectionView
