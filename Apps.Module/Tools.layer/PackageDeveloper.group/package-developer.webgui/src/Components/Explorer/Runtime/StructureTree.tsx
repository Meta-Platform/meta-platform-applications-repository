import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "@i-components"

import { RuntimeItem } from "../../../Domain/packageModel"
import { PropertyGroup } from "../../../Domain/values"
import CopyableCodeValue from "../ui/CopyableCodeValue"
import EndpointRoutes from "./EndpointRoutes"
import { IssueBadges, IssueList } from "../ui/ValidationBadge"
import { Badge } from "../ui/Primitives"

// A visão ESTRUTURA como árvore de detalhes: recurso → grupos (identidade,
// params, bound-params, subcomandos…) → valores. Mesma gramática da árvore de
// pacotes (chevron, indentação, guia vertical, linha selecionada), só que aqui
// os nós são as propriedades do metadado — antes tudo caía no mesmo nível e não
// dava para ver o que pertencia a quê.

type Props = {
    items       : RuntimeItem[]
    selectedId? : string
    onSelect    : (itemId:string) => void
    onOpenRef?  : (target:string) => void
    // "expandir/recolher tudo": undefined deixa cada nó com o padrão dele.
    forceOpen?  : boolean
    // Necessários para ler o api-template de um endpoint (rotas do controller).
    workspace?  : string
    pkg?        : { name:string, ext:string }
}

// Grupos que ganham nó próprio, na ordem em que ajudam a ler o recurso.
const GROUP_ICON:any = {
    "identidade"            : "id badge outline",
    "implementação"         : "code",
    "params"                : "sliders horizontal",
    "bound-params"          : "linkify",
    "params exigidos"       : "lock",
    "bound-params exigidos" : "lock",
    "parâmetros"            : "sliders horizontal",
    "parametersToLoad"      : "download",
    "descrição"             : "align left",
    "janela"                : "window maximize outline",
    "valor declarado"       : "check square outline"
}

const GroupNode = ({ group, level, onOpenRef, defaultOpen }:
    { group:PropertyGroup, level:number, onOpenRef?:(t:string) => void, defaultOpen:boolean }) => {

    const [open, setOpen] = useState(defaultOpen)
    return <li className="pdx-stree__group">
        <button type="button" className="pdx-stree__row pdx-stree__row--group"
            style={{ paddingLeft: 8 + level * 16 }}
            aria-expanded={open}
            onClick={() => setOpen(!open)}>
            <Icon name={open ? "caret down" : "caret right"} style={{margin:0, color:"var(--mp-muted)"}} />
            <Icon name={(GROUP_ICON[group.label] || "circle outline") as any}
                style={{margin:0, color:"var(--mp-muted)"}} />
            <span className="pdx-stree__grouplabel">{group.label}</span>
            <span className="pdx-stree__count">{group.entries.length}</span>
        </button>
        {
            open &&
            <ul className="pdx-stree__values" style={{ paddingLeft: 8 + (level + 1) * 16 }}>
                {
                    group.entries.map((entry, i) =>
                        <li key={`${entry.label}-${i}`} className="pdx-stree__value">
                            {
                                group.variant === "chips"
                                ? <CopyableCodeValue value={entry.value} type={entry.type}
                                    refTarget={entry.refTarget} onOpenRef={onOpenRef} />
                                : <>
                                    <span className="pdx-stree__key">{entry.label}</span>
                                    <CopyableCodeValue value={entry.value} type={entry.type}
                                        refTarget={entry.refTarget} onOpenRef={onOpenRef} />
                                  </>
                            }
                        </li>)
                }
            </ul>
        }
    </li>
}

const ItemNode = ({ item, level, selectedId, onSelect, onOpenRef, forceOpen, workspace, pkg }:
    { item:RuntimeItem, level:number, selectedId?:string, onSelect:(id:string) => void,
      onOpenRef?:(t:string) => void, forceOpen?:boolean,
      workspace?:string, pkg?:{ name:string, ext:string } }) => {

    const selected = selectedId === item.id
    const [open, setOpen] = useState(forceOpen !== undefined ? forceOpen : selected)
    // Selecionar de fora (árvore de pacotes, diagrama, link) abre o recurso aqui.
    useEffect(() => { if(selected) setOpen(true) }, [selected])

    const groups = item.groups.filter((g) => g.entries.length > 0)
    const children = item.children || []
    // Endpoint de controller: as rotas (com método HTTP) moram no api-template.
    const apiTemplate = item.kind === "endpoint" && item.raw && item.raw.params
        ? item.raw.params["api-template"]
        : undefined
    const expandable = groups.length > 0 || children.length > 0 || item.issues.length > 0

    return <li className={`pdx-stree__item${selected ? " pdx-stree__item--selected" : ""}`}>
        <div className={`pdx-stree__row pdx-stree__row--item${selected ? " pdx-stree__row--selected" : ""}`}
            style={{ paddingLeft: 4 + level * 16 }}
            role="treeitem"
            aria-selected={selected}
            aria-expanded={expandable ? open : undefined}
            tabIndex={0}
            onClick={() => onSelect(item.id)}
            onKeyDown={(e:any) => {
                if(e.key === "Enter" || e.key === " "){ e.preventDefault(); onSelect(item.id) }
                if(e.key === "ArrowRight" && expandable){ e.preventDefault(); setOpen(true) }
                if(e.key === "ArrowLeft" && expandable){ e.preventDefault(); setOpen(false) }
            }}>
            <span className={`pdx-stree__twisty${expandable ? "" : " pdx-stree__twisty--leaf"}`}
                role="button" tabIndex={-1}
                aria-label={open ? "recolher" : "expandir"}
                onClick={(e:any) => { e.stopPropagation(); if(expandable) setOpen(!open) }}>
                <Icon name={open ? "caret down" : "caret right"} style={{margin:0}} />
            </span>
            <Icon name={item.icon as any} style={{margin:0, color:"var(--mp-muted)"}} />
            <span className="pdx-stree__name">{item.title}</span>
            { item.subtitle &&
                <span className="pdx-stree__sub" title={item.subtitle}>{item.subtitle}</span> }
            <span className="pdx-stree__badges">
                <IssueBadges issues={item.issues} compact />
                { children.length > 0 && <Badge>{children.length} sub</Badge> }
            </span>
        </div>

        {
            open &&
            <ul className="pdx-stree__children">
                {
                    groups.map((group) =>
                        <GroupNode key={group.label} group={group} level={level + 1} onOpenRef={onOpenRef}
                            // O recurso selecionado abre inteiro: é o que se quer
                            // ver. Os demais abrem só a identidade, para a seção
                            // continuar escaneável.
                            defaultOpen={forceOpen !== undefined
                                ? forceOpen
                                : selected || group.label === "identidade" || groups.length <= 2} />)
                }
                {
                    item.refs.length > 0 &&
                    <li className="pdx-stree__group">
                        <div className="pdx-stree__row pdx-stree__row--group" style={{ paddingLeft: 8 + (level + 1) * 16 }}>
                            <span className="pdx-stree__twisty pdx-stree__twisty--leaf" />
                            <Icon name="sitemap" style={{margin:0, color:"var(--mp-muted)"}} />
                            <span className="pdx-stree__grouplabel">pacotes relacionados</span>
                            <span className="pdx-stree__count">{item.refs.length}</span>
                        </div>
                        <ul className="pdx-stree__values" style={{ paddingLeft: 8 + (level + 2) * 16 }}>
                            {
                                item.refs.map((ref) =>
                                    <li key={ref} className="pdx-stree__value">
                                        <CopyableCodeValue value={ref} type="reference"
                                            refTarget={ref} onOpenRef={onOpenRef} />
                                    </li>)
                            }
                        </ul>
                    </li>
                }
                {
                    apiTemplate && workspace && pkg &&
                    <li className="pdx-stree__group pdx-stree__routes"
                        style={{ paddingLeft: 8 + (level + 1) * 16, paddingRight: 10 }}>
                        <EndpointRoutes workspace={workspace} pkg={pkg}
                            apiTemplate={apiTemplate} baseUrl={item.raw && item.raw.url} />
                    </li>
                }
                {
                    item.issues.length > 0 &&
                    <li className="pdx-stree__group" style={{ paddingLeft: 8 + (level + 1) * 16, paddingRight: 8 }}>
                        <IssueList issues={item.issues} />
                    </li>
                }
                {
                    children.map((child) =>
                        <ItemNode key={child.id} item={child} level={level + 1}
                            selectedId={selectedId} onSelect={onSelect} onOpenRef={onOpenRef}
                            forceOpen={forceOpen} workspace={workspace} pkg={pkg} />)
                }
            </ul>
        }
    </li>
}

const StructureTree = ({ items, selectedId, onSelect, onOpenRef, forceOpen, workspace, pkg }:Props) => {
    if(!items || !items.length) return null
    return <ul className="pdx-stree" role="tree" aria-label="Estrutura do recurso">
        {
            items.map((item) =>
                <ItemNode key={item.id} item={item} level={0}
                    selectedId={selectedId} onSelect={onSelect} onOpenRef={onOpenRef}
                    forceOpen={forceOpen} workspace={workspace} pkg={pkg} />)
        }
    </ul>
}

export default StructureTree
