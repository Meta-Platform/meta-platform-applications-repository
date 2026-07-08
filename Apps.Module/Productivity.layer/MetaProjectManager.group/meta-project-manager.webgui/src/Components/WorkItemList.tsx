import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem, User, Milestone, Sprint } from "../api/types"
import { GroupBy } from "../Hooks/useItemFilters"
import { TypeBadge, ValueBadge, Avatar, ItemMeta } from "./Primitives"
import { horizonLabel } from "../Utils/format"

const PRIORITIES = ["none", "low", "medium", "high", "urgent"]

interface StatusOption { statusKey: string; name: string }

interface WorkItemListProps {
    items: WorkItem[]
    usersById: { [id: string]: User }
    statusOptions?: StatusOption[]
    groupBy?: GroupBy
    milestones?: Milestone[]
    sprints?: Sprint[]
    onOpenItem: (id: string) => void
    onSetStatus: (id: string, status: string) => void
    onSetPriority: (id: string, priority: string) => void
}

interface TreeNode extends WorkItem { _children: TreeNode[] }

// WorkItemList (spec §11.1 / Fase 2): tabela hierárquica (epic→feature→story→
// task→subtask) expansível com edição inline; ou agrupada por horizonte/área/
// sprint quando groupBy != none/parent.
const WorkItemList = ({ items, usersById, statusOptions, groupBy, milestones, sprints,
    onOpenItem, onSetStatus, onSetPriority }: WorkItemListProps) => {
    const [collapsed, setCollapsed] = useState<{ [id: string]: boolean }>({})

    const byId: { [id: string]: TreeNode } = {}
    items.forEach((i) => { byId[i.id] = { ...i, _children: [] } as TreeNode })
    const roots: TreeNode[] = []
    items.forEach((i) => {
        const node = byId[i.id]
        if (i.parentId && byId[i.parentId]) byId[i.parentId]._children.push(node)
        else roots.push(node)
    })

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
            <tr key={node.id} className="mpm-table__row--clickable">
                <td>
                    <span className="mpm-tree-indent" style={{ width: depth * 18 }} />
                    {hasChildren
                        ? <span className="mpm-tree-toggle" onClick={() => setCollapsed((c) => ({ ...c, [node.id]: !c[node.id] }))}>
                            <Icon name={isCollapsed ? "caret right" : "caret down"} />
                        </span>
                        : <span className="mpm-tree-toggle" />}
                    <TypeBadge type={node.type} />
                    <span className="mpm-mono mpm-muted" style={{ margin: "0 6px" }}>{node.key}</span>
                    <span onClick={() => onOpenItem(node.id)} style={{ cursor: "pointer", fontWeight: 600 }}>{node.title}</span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                    <select className="mpm-inline-select" value={node.statusKey}
                        onChange={(e) => onSetStatus(node.id, e.target.value)}>
                        {(statuses.length > 0 ? statuses : [{ statusKey: node.statusKey, name: node.statusKey }]).map((s) =>
                            <option key={s.statusKey} value={s.statusKey}>{s.name}</option>)}
                    </select>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                    <select className="mpm-inline-select" value={node.priority}
                        onChange={(e) => onSetPriority(node.id, e.target.value)}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </td>
                <td><ValueBadge value={node.value} /></td>
                <td><Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} /></td>
                <td><ItemMeta item={node} /></td>
            </tr>
        ]
        if (hasChildren && !isCollapsed)
            node._children.forEach((child) => rows.push(...renderRow(child, depth + 1, true)))
        return rows
    }

    const header = <thead>
        <tr>
            <th>Item</th>
            <th style={{ width: 150 }}>Status</th>
            <th style={{ width: 110 }}>Prioridade</th>
            <th style={{ width: 80 }}>Valor</th>
            <th style={{ width: 56 }}>Resp.</th>
            <th style={{ width: 100 }}>Info</th>
        </tr>
    </thead>

    const grouped = groupBy && ["horizon", "area", "sprint"].indexOf(groupBy) >= 0

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
                        <table className="mpm-table">
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
        <table className="mpm-table">
            {header}
            <tbody>
                {roots.map((r) => renderRow(r, 0, true))}
            </tbody>
        </table>
    </div>
}

export default WorkItemList
