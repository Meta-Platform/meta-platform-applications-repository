import * as React from "react"
import { useRef, useState } from "react"
import { Icon, Loader } from "semantic-ui-react"

import { Facets, Filters, SearchResult, hasActiveFilters } from "../../Domain/packageIndex"
import { Selection } from "../../Domain/selection"
import PackageSearchFilters, { ActiveFilters } from "./PackageSearchFilters"
import PackageResultsTree from "./PackageResultsTree"
import { EmptyState, IconButton } from "./ui/Primitives"

// Painel 3: busca, filtros e resultados. A busca é o instrumento principal de
// descoberta — vale para nome, namespace, tipo, serviço, executável, comando,
// endpoint e controller (ver Domain/packageIndex).

type Props = {
    workspace   : string
    repository  : string
    scopeLabel  : string
    onClearScope? : () => void
    filters     : Filters
    onFilters   : (f:Filters) => void
    facets      : Facets
    results     : SearchResult[]
    total       : number
    loading?    : boolean
    error?      : string
    onRetry?    : () => void
    expanded    : {[k:string]:boolean}
    onToggle    : (key:string) => void
    selection?  : Selection
    onSelect    : (s:Selection) => void
    onEditPackage? : (pkg:any) => void
    onContextMenu? : (e:any, pkg:any) => void
    statusByPath?  : any
}

const PackageExplorerPanel = ({
    workspace, repository, scopeLabel, onClearScope, filters, onFilters, facets,
    results, total, loading, error, onRetry, expanded, onToggle, selection, onSelect,
    onEditPackage, onContextMenu, statusByPath
}:Props) => {

    const [showFilters, setShowFilters] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    return <div className="pdx-panel pdx-panel--results" style={{flex:"1 1 auto"}}>
        <div className="pdx-search">
            <div className="pdx-search__field">
                <Icon name="search" style={{margin:0, color:"var(--mp-muted)"}} />
                <input ref={inputRef}
                    value={filters.query}
                    aria-label="Buscar pacotes, serviços, endpoints e comandos"
                    placeholder="Buscar pacote, serviço, endpoint, comando…"
                    onChange={(e:any) => onFilters({ ...filters, query: e.target.value })}
                    onKeyDown={(e:any) => { if(e.key === "Escape" && filters.query) onFilters({ ...filters, query: "" }) }} />
                { filters.query &&
                    <IconButton icon="times" label="Limpar busca" ghost
                        onClick={() => { onFilters({ ...filters, query: "" }); inputRef.current && inputRef.current.focus() }} /> }
            </div>
            <IconButton icon="filter" label="Filtros" text="Filtros" active={showFilters || hasActiveFilters(filters)}
                title="Filtros por tipo, módulo, layer e capacidade"
                onClick={() => setShowFilters(!showFilters)} />
        </div>

        { showFilters && <PackageSearchFilters filters={filters} facets={facets} onChange={onFilters} /> }

        <ActiveFilters filters={filters} onChange={onFilters} resultCount={results.length} />

        <div className="pdx-panel__head" style={{minHeight:30}}>
            <span className="pdx-panel__title">{scopeLabel}</span>
            { onClearScope &&
                <IconButton icon="times" label="Ampliar escopo para o repositório" ghost onClick={onClearScope} /> }
            <span className="pdx-panel__count" aria-live="polite">
                {results.length}{results.length !== total ? ` / ${total}` : ""}
            </span>
        </div>

        <div className="pdx-panel__body pdx-panel__body--flush">
            {
                error
                ? <EmptyState icon="exclamation triangle" title="Falha ao carregar os pacotes" hint={error}
                    action={onRetry ? <IconButton icon="redo" label="Tentar novamente" text="Tentar novamente" onClick={onRetry} /> : undefined} />
                : loading && !total
                ? <Loader active inline="centered" style={{marginTop:24}} />
                : results.length === 0
                ? <EmptyState icon="search"
                    title={hasActiveFilters(filters) ? "Nenhum pacote corresponde" : "Nenhum pacote neste escopo"}
                    hint={filters.query.trim()
                        ? `Nada casa com “${filters.query.trim()}” nos filtros atuais.`
                        : "Ajuste os filtros ou escolha outro módulo/layer."}
                    action={hasActiveFilters(filters)
                        ? <IconButton icon="eraser" label="Limpar filtros" text="Limpar filtros"
                            onClick={() => onFilters({ query: "", types: [], modules: [], layers: [], capabilities: [] })} />
                        : undefined} />
                : <PackageResultsTree
                    workspace={workspace}
                    repository={repository}
                    results={results}
                    query={filters.query}
                    expanded={expanded}
                    onToggle={onToggle}
                    selection={selection}
                    onSelect={onSelect}
                    onEditPackage={onEditPackage}
                    onContextMenu={onContextMenu}
                    statusByPath={statusByPath} />
            }
        </div>
    </div>
}

export default PackageExplorerPanel
