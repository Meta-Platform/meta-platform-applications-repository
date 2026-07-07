import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem, User } from "../api/types"
import { TypeBadge, Avatar, ItemMeta } from "./Primitives"

const PRIORITIES = ["none", "low", "medium", "high", "urgent"]

interface StatusOption { statusKey: string; name: string }

interface WorkItemListProps {
    items: WorkItem[]
    usersById: { [id: string]: User }
    statusOptions?: StatusOption[]
    onOpenItem: (id: string) => void
    onSetStatus: (id: string, status: string) => void
    onSetPriority: (id: string, priority: string) => void
}

interface TreeNode extends WorkItem { _children: TreeNode[] }

// WorkItemList (spec §11.1): tabela hierárquica (história -> tarefa -> subtarefa)
// expansível, com edição inline de status/prioridade.
const WorkItemList = ({ items, usersById, statusOptions, onOpenItem, onSetStatus, onSetPriority }: WorkItemListProps) => {
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

    const renderRow = (node: TreeNode, depth: number): React.ReactNode[] => {
        const assignee = node.assigneeUserId ? usersById[node.assigneeUserId] : undefined
        const hasChildren = node._children.length > 0
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
                <td><Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} /></td>
                <td><ItemMeta item={node} /></td>
            </tr>
        ]
        if (hasChildren && !isCollapsed)
            node._children.forEach((child) => rows.push(...renderRow(child, depth + 1)))
        return rows
    }

    return <div className="mpm-scroll-x">
        <table className="mpm-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th style={{ width: 160 }}>Status</th>
                    <th style={{ width: 120 }}>Prioridade</th>
                    <th style={{ width: 60 }}>Resp.</th>
                    <th style={{ width: 120 }}>Info</th>
                </tr>
            </thead>
            <tbody>
                {roots.map((r) => renderRow(r, 0))}
            </tbody>
        </table>
    </div>
}

export default WorkItemList
