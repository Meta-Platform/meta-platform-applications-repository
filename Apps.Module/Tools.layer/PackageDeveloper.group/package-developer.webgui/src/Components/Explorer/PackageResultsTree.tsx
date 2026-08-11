import * as React from "react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { Icon } from "@i-components"

import { SearchResult, highlightSegments } from "../../Domain/packageIndex"
import { RuntimeItem } from "../../Domain/packageModel"
import { Selection, selectionKey } from "../../Domain/selection"
import PackageIcon from "../PackageIcon"
import TreeRow from "./ui/TreeRow"
import { IssueBadges } from "./ui/ValidationBadge"
import { GitBadge, gitEntry, gitNameStyle, gitTitle } from "../../Utils/gitDecor"

// Resultados da busca como árvore: pacote → seções → itens (as capacidades já
// vêm do índice, então expandir é instantâneo e não dispara request).
//
// Interação (o ponto que estava quebrado): o chevron só expande; a linha só
// seleciona; e a seleção é sempre um recurso identificável, que o Inspector
// espelha. Teclado: ↑/↓ move, →/← expande/recolhe, Enter/Espaço seleciona.

type Row = {
    key      : string
    level    : number
    type     : "package" | "section" | "item"
    label    : string
    sub?     : string
    icon     : React.ReactNode
    meta?    : React.ReactNode
    expandable : boolean
    selection: Selection
    result?  : SearchResult
    itemId?  : string
}

type Props = {
    workspace   : string
    results     : SearchResult[]
    query       : string
    expanded    : {[key:string]:boolean}
    onToggle    : (key:string) => void
    selection?  : Selection
    onSelect    : (selection:Selection) => void
    onEditPackage? : (pkg:any) => void
    onContextMenu? : (e:any, pkg:any) => void
    statusByPath?  : any
    repository  : string
    showRepository? : boolean          // escopo workspace: de qual repo é o pacote
    favorites?  : string[]
    onToggleFavorite? : (path:string) => void
}

const Highlight = ({ text, query }:{ text:string, query:string }) =>
    <>{ highlightSegments(text, query).map((seg, i) => seg.hit ? <mark key={i} className="pdx-hit">{seg.text}</mark> : <React.Fragment key={i}>{seg.text}</React.Fragment>) }</>

const buildRows = (
    { results, expanded, repository, workspace, query, statusByPath, showRepository }:
    { results:SearchResult[], expanded:any, repository:string, workspace:string, query:string, statusByPath:any, showRepository?:boolean }
):Row[] => {
    const rows:Row[] = []
    results.forEach((result) => {
        const pkg = result.pkg
        const pkgKey = `package:${pkg.path}`
        const git = gitEntry(statusByPath, pkg.path)
        rows.push({
            key: pkgKey,
            level: 0,
            type: "package",
            label: pkg.name,
            icon: <PackageIcon workspace={pkg.repository || workspace} name={pkg.name} ext={pkg.ext} size={16} />,
            expandable: pkg.model.sections.length > 0,
            selection: { kind: "package", repository: pkg.repository || repository, packagePath: pkg.path },
            meta: <span className="pdx-inline" style={{gap:4}}>
                { showRepository && pkg.repository &&
                    <span className="pdx-why__chip" title={`repositório ${pkg.repository}`}>{pkg.repository}</span> }
                <GitBadge entry={git} />
                <IssueBadges issues={pkg.model.issues} compact />
            </span>,
            result
        })
        if(!expanded[pkgKey]) return

        pkg.model.sections.forEach((section) => {
            const sectionKey = `section:${pkg.path}#${section.id}`
            rows.push({
                key: sectionKey,
                level: 1,
                type: "section",
                label: section.title,
                icon: <Icon name={section.icon as any} style={{margin:0}} />,
                meta: <span>{section.items.length}</span>,
                expandable: section.items.length > 0,
                selection: { kind: "section", repository: pkg.repository || repository, packagePath: pkg.path, sectionId: section.id }
            })
            if(!expanded[sectionKey]) return

            const pushItem = (item:RuntimeItem, level:number) => {
                const itemKey = `item:${pkg.path}#${item.id}`
                const hasChildren = !!(item.children && item.children.length)
                rows.push({
                    key: itemKey,
                    level,
                    type: "item",
                    label: item.title,
                    sub: item.subtitle,
                    icon: <Icon name={item.icon as any} style={{margin:0}} />,
                    expandable: hasChildren,
                    selection: { kind: "item", repository: pkg.repository || repository, packagePath: pkg.path, itemId: item.id },
                    itemId: item.id
                })
                if(hasChildren && expanded[itemKey]) item.children!.forEach((child) => pushItem(child, level + 1))
            }
            section.items.forEach((item) => pushItem(item, 2))
        })
    })
    return rows
}

const PackageResultsTree = ({
    workspace, results, query, expanded, onToggle, selection, onSelect,
    onEditPackage, onContextMenu, statusByPath, repository, showRepository,
    favorites, onToggleFavorite
}:Props) => {

    const rows = useMemo(
        () => buildRows({ results, expanded, repository, workspace, query, statusByPath, showRepository }),
        [results, expanded, repository, workspace, query, statusByPath, showRepository])

    const activeKey = selectionKey(selection)
    const focusIndex = useRef<number>(0)
    const containerRef = useRef<HTMLUListElement>(null)

    // Mantém o item selecionado visível quando a seleção vem de fora (link,
    // diagrama, breadcrumb) — sem roubar o scroll durante a navegação normal.
    useEffect(() => {
        const index = rows.map((r) => selectionKey(r.selection)).indexOf(activeKey)
        if(index < 0 || !containerRef.current) return
        focusIndex.current = index
        const el = containerRef.current.querySelectorAll("[role='treeitem']")[index] as HTMLElement
        if(el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" })
    }, [activeKey, rows.length])

    const move = useCallback((delta:number) => {
        if(!containerRef.current) return
        const next = Math.max(0, Math.min(rows.length - 1, focusIndex.current + delta))
        focusIndex.current = next
        const el = containerRef.current.querySelectorAll("[role='treeitem']")[next] as HTMLElement
        if(el) el.focus()
    }, [rows.length])

    const onKeyDown = (row:Row, index:number) => (e:any) => {
        focusIndex.current = index
        if(e.key === "ArrowDown"){ e.preventDefault(); move(1) }
        else if(e.key === "ArrowUp"){ e.preventDefault(); move(-1) }
        else if(e.key === "ArrowRight"){
            e.preventDefault()
            if(row.expandable && !expanded[row.key]) onToggle(row.key)
            else move(1)
        }
        else if(e.key === "ArrowLeft"){
            e.preventDefault()
            if(row.expandable && expanded[row.key]) onToggle(row.key)
            else move(-1)
        }
        else if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onSelect(row.selection) }
    }

    // Leitor de tela: anuncia o recurso que passou a estar selecionado.
    const selectedRow = rows.filter((r) => selectionKey(r.selection) === activeKey)[0]

    return <>
        <div className="pdx-sr-only" role="status" aria-live="polite">
            { selectedRow ? `Selecionado: ${selectedRow.label}` : "" }
        </div>
        <ul className="pdx-tree" role="tree" aria-label="Pacotes e capacidades" ref={containerRef}>
        {
            rows.map((row, index) => {
                const isSelected = selectionKey(row.selection) === activeKey
                const git = row.type === "package" && row.result
                    ? gitEntry(statusByPath, row.result.pkg.path)
                    : undefined
                return <TreeRow key={row.key}
                    level={row.level}
                    label={
                        row.type === "package" && row.result
                        ? <span style={gitNameStyle(git)}>
                            <b><Highlight text={row.label} query={query} /></b>
                            <span className="pdx-row__ext">.{row.result.pkg.ext}</span>
                          </span>
                        : <Highlight text={row.label} query={query} />
                    }
                    sub={
                        row.type === "package" && row.result && row.result.matches.length
                        ? <span className="pdx-why">
                            {
                                row.result.matches.map((m, i) =>
                                    <span key={i} className="pdx-why__chip">
                                        <span className="pdx-why__field">{m.field}: </span>
                                        <Highlight text={m.text} query={query} />
                                    </span>)
                            }
                          </span>
                        : row.sub
                    }
                    icon={row.icon}
                    meta={row.meta}
                    title={row.type === "package" && row.result ? (gitTitle(git) || row.result.pkg.path) : row.sub}
                    expandable={row.expandable}
                    expanded={!!expanded[row.key]}
                    selected={isSelected}
                    tabIndex={index === focusIndex.current ? 0 : -1}
                    onKeyDown={onKeyDown(row, index)}
                    onToggle={() => onToggle(row.key)}
                    onSelect={() => onSelect(row.selection)}
                    onDoubleClick={row.type === "package" && row.result && onEditPackage
                        ? () => onEditPackage(row.result!.pkg)
                        : undefined}
                    onContextMenu={row.type === "package" && row.result && onContextMenu
                        ? (e:any) => onContextMenu(e, row.result!.pkg)
                        : undefined}
                    action={row.type === "package" && row.result && onToggleFavorite
                        ? <button type="button" className="pdx-copy pdx-fav"
                            aria-pressed={!!favorites && favorites.indexOf(row.result.pkg.path) > -1}
                            aria-label={favorites && favorites.indexOf(row.result.pkg.path) > -1
                                ? `remover ${row.result.pkg.dirname} dos favoritos`
                                : `favoritar ${row.result.pkg.dirname}`}
                            title="Favoritar"
                            onClick={(e:any) => { e.stopPropagation(); onToggleFavorite(row.result!.pkg.path) }}>
                            <Icon name={favorites && favorites.indexOf(row.result.pkg.path) > -1 ? "star" : "star outline"}
                                style={{margin:0}} />
                          </button>
                        : undefined} />
            })
        }
        </ul>
    </>
}

export default PackageResultsTree
