import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem, User, Milestone, Sprint } from "../api/types"
import { GroupBy } from "../Hooks/useItemFilters"
import { TypeBadge, ValueBadge, AreaBadge, Avatar, ItemMeta } from "./Primitives"
import { horizonLabel, formatDate } from "../Utils/format"

const PRIORITIES = ["none", "low", "medium", "high", "urgent"]

interface StatusOption { statusKey: string; name: string }

interface WorkItemListProps {
    items: WorkItem[]
    usersById: { [id: string]: User }
    statusOptions?: StatusOption[]
    groupBy?: GroupBy
    milestones?: Milestone[]
    sprints?: Sprint[]
    selectedIds?: string[]
    onToggleSelect?: (id: string) => void
    onOpenItem: (id: string) => void
    onSetStatus: (id: string, status: string) => void
    onSetPriority: (id: string, priority: string) => void
    // Projeto arquivado: selects de status/prioridade viram leitura (desabilitados).
    readOnly?: boolean
}

interface TreeNode extends WorkItem { _children: TreeNode[] }

// WorkItemList (spec §11.1 / Fase 2): tabela hierárquica (epic→feature→story→
// task→subtask) expansível com edição inline; ou agrupada por horizonte/área/
// sprint quando groupBy != none/parent. Suporta seleção múltipla (feature 4).
const WorkItemList = ({ items, usersById, statusOptions, groupBy, milestones, sprints,
    selectedIds, onToggleSelect, onOpenItem, onSetStatus, onSetPriority, readOnly }: WorkItemListProps) => {
    const [collapsed, setCollapsed] = useState<{ [id: string]: boolean }>({})
    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const selectable = !!onToggleSelect
    const isSelected = (id: string) => !!selectedIds && selectedIds.indexOf(id) >= 0

    // Estados críticos mostrados como ícone (não pintam a linha inteira): a
    // severidade fica na cor do ícone + tooltip, sem transformar a lista num
    // arco-íris. "Atrasado" usa heurística de status (não há flag de conclusão no
    // item): prazo vencido e ainda não concluído/arquivado.
    const now = Date.now()
    const isOverdue = (n: WorkItem) =>
        !!n.dueDate && n.statusKey !== "done" && n.statusKey !== "archived"
        && new Date(n.dueDate).getTime() < now

    const copyKey = (key: string) => {
        try { if (navigator.clipboard) navigator.clipboard.writeText(key) } catch (_) { /* clipboard indisponível */ }
        setCopiedKey(key)
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200)
    }

    const byId: { [id: string]: TreeNode } = {}
    items.forEach((i) => { byId[i.id] = { ...i, _children: [] } as TreeNode })
    const roots: TreeNode[] = []
    items.forEach((i) => {
        const node = byId[i.id]
        if (i.parentId && byId[i.parentId]) byId[i.parentId]._children.push(node)
        else roots.push(node)
    })

    // Colapsar/expandir TUDO: um botão no cabeçalho da coluna Item.
    const collapsibleIds = Object.values(byId).filter((n) => n._children.length > 0).map((n) => n.id)
    const allCollapsed = collapsibleIds.length > 0 && collapsibleIds.every((id) => collapsed[id])
    const toggleAll = () => {
        if (allCollapsed) { setCollapsed({}); return }
        const next: { [id: string]: boolean } = {}
        collapsibleIds.forEach((id) => { next[id] = true })
        setCollapsed(next)
    }
    const grouped = groupBy && ["horizon", "area", "sprint"].indexOf(groupBy) >= 0

    const statuses: StatusOption[] = statusOptions && statusOptions.length > 0 ? statusOptions : []

    const nameById = (list: any[] | undefined, id?: string | null) =>
        (id && list) ? ((list.find((x) => x.id === id) || {}).name || id) : ""

    // chave + rótulo de grupo de um item, conforme groupBy
    const groupOf = (it: WorkItem): { key: string; label: string } => {
        switch (groupBy) {
            case "horizon": return { key: it.horizon || "_none", label: it.horizon ? horizonLabel(it.horizon) : "Sem horizonte" }
            case "area":    return { key: it.area || "_none", label: it.area || "Sem área" }
            case "sprint":  return { key: it.sprintId || "_none", label: it.sprintId ? nameById(sprints, it.sprintId) : "Sem sprint" }
            default:        return { key: "_all", label: "" }
        }
    }

    // tree=true recorre filhos (hierarquia); tree=false = linha plana (agrupado)
    const renderRow = (node: TreeNode, depth: number, tree: boolean): React.ReactNode[] => {
        const assignee = node.assigneeUserId ? usersById[node.assigneeUserId] : undefined
        const hasChildren = tree && node._children.length > 0
        const isCollapsed = collapsed[node.id]
        const rows: React.ReactNode[] = [
            <tr key={node.id} data-item-id={node.id}
                className={`mpm-table__row--clickable ${node.type === "epic" ? "is-epic" : ""} ${depth === 0 ? "is-root" : ""}`}>
                {selectable
                    ? <td onClick={(e) => e.stopPropagation()} style={{ width: 32 }}>
                        <input type="checkbox" checked={isSelected(node.id)} onChange={() => onToggleSelect!(node.id)} />
                    </td>
                    : null}
                {/* 2 linhas: metadados em ordem fixa + título com clamp (antes o
                    título comprimia em 3-4 linhas e as chips trocavam de ordem). */}
                <td>
                    <div className={`mpm-itemcell ${depth > 0 ? "mpm-itemcell--child" : ""}`} style={{ paddingLeft: depth * 18 }}>
                        <div className="mpm-itemcell__meta">
                            {hasChildren
                                ? <span className="mpm-tree-toggle" data-tip={isCollapsed ? "Mostrar os subitens" : "Ocultar os subitens"}
                                    onClick={(e) => { e.stopPropagation(); setCollapsed((c) => ({ ...c, [node.id]: !c[node.id] })) }}>
                                    <Icon name={isCollapsed ? "caret right" : "caret down"} />
                                    <span className="mpm-tree-count">{node._children.length}</span>
                                </span>
                                : <span className="mpm-tree-toggle" />}
                            <span className={`mpm-mono mpm-muted mpm-key ${copiedKey === node.key ? "is-copied" : ""}`}
                                data-tip={copiedKey === node.key ? "Chave copiada!" : "Copiar a chave do item"}
                                onClick={(e) => { e.stopPropagation(); copyKey(node.key) }}>
                                {node.key}<Icon name={copiedKey === node.key ? "check" : "copy outline"} className="mpm-key__ico" />
                            </span>
                            <TypeBadge type={node.type} />
                            <AreaBadge area={node.area} />
                            {node.blockedReason
                                ? <span className="mpm-state mpm-state--blocked" title={`Bloqueado: ${node.blockedReason}`}><Icon name="ban" /></span>
                                : null}
                            {isOverdue(node)
                                ? <span className="mpm-state mpm-state--overdue" title={`Atrasado — prazo ${formatDate(node.dueDate)}`}><Icon name="clock outline" /></span>
                                : null}
                        </div>
                        <div className="mpm-itemcell__title-row">
                            <span className="mpm-itemcell__title" title={node.title}
                                onClick={() => onOpenItem(node.id)} style={{ cursor: "pointer" }}>{node.title}</span>
                            <ItemMeta item={node} />
                        </div>
                    </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                    <select className="mpm-inline-select" value={node.statusKey} disabled={readOnly}
                        onChange={(e) => onSetStatus(node.id, e.target.value)}>
                        {(statuses.length > 0 ? statuses : [{ statusKey: node.statusKey, name: node.statusKey }]).map((s) =>
                            <option key={s.statusKey} value={s.statusKey}>{s.name}</option>)}
                    </select>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                    <select className="mpm-inline-select" value={node.priority} disabled={readOnly}
                        onChange={(e) => onSetPriority(node.id, e.target.value)}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </td>
                <td><ValueBadge value={node.value} /></td>
                <td><Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} /></td>
            </tr>
        ]
        if (hasChildren && !isCollapsed)
            node._children.forEach((child) => rows.push(...renderRow(child, depth + 1, true)))
        return rows
    }

    const colgroup = <colgroup>
        {selectable ? <col style={{ width: 32 }} /> : null}
        <col style={{ width: "auto" }} />
        <col style={{ width: 148 }} />
        <col style={{ width: 108 }} />
        <col style={{ width: 74 }} />
        <col style={{ width: 56 }} />
    </colgroup>

    const header = <thead>
        <tr>
            {selectable ? <th /> : null}
            <th>
                <span className="mpm-th-item">
                    Item
                    {!grouped && collapsibleIds.length > 0
                        ? <button className="mpm-iconbtn mpm-btn--sm mpm-th-collapse" onClick={toggleAll}
                            data-tip={allCollapsed ? "Expandir todos" : "Recolher todos"}>
                            <Icon name={allCollapsed ? "expand" : "compress"} />
                        </button>
                        : null}
                </span>
            </th>
            <th title="Situação no fluxo (coluna do board)">Status</th>
            <th title="Quão urgente é fazer">Prioridade</th>
            <th title="Impacto/benefício">Valor</th>
            <th title="Responsável">Resp.</th>
        </tr>
    </thead>

    if (grouped) {
        // buckets de TODOS os itens pela chave de grupo (visão plana por grupo)
        const order: string[] = []
        const buckets: { [k: string]: { label: string; items: WorkItem[] } } = {}
        items.forEach((it) => {
            const g = groupOf(it)
            if (!buckets[g.key]) { buckets[g.key] = { label: g.label, items: [] }; order.push(g.key) }
            buckets[g.key].items.push(it)
        })
        return <div className="mpm-col mpm-gap-4">
            {order.map((k) =>
                <div key={k} className="mpm-panel">
                    <div className="mpm-panel__title"><Icon name="folder" /> {buckets[k].label} <span className="mpm-chip mpm-chip--neutral">{buckets[k].items.length}</span></div>
                    <div className="mpm-scroll-x">
                        <table className="mpm-table mpm-table--fixed">
                            {colgroup}
                            {header}
                            <tbody>
                                {buckets[k].items.map((it) => renderRow(byId[it.id], 0, false))}
                            </tbody>
                        </table>
                    </div>
                </div>)}
        </div>
    }

    return <div className="mpm-scroll-x">
        <table className="mpm-table mpm-table--fixed">
            {colgroup}
            {header}
            <tbody>
                {roots.map((r) => renderRow(r, 0, true))}
            </tbody>
        </table>
    </div>
}

export default WorkItemList
