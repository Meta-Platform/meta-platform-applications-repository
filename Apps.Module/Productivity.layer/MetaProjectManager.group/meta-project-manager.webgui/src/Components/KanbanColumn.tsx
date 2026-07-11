import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { WorkItem, BoardColumn, User } from "../api/types"
import WorkItemCard from "./WorkItemCard"

interface KanbanColumnProps {
    column: BoardColumn
    items: WorkItem[]
    usersById: { [id: string]: User }
    draggingId?: string | null
    onOpenItem: (id: string) => void
    onDragStart: (id: string) => void
    onDragEnd: () => void
    onDropItem: (statusKey: string) => void
    onReorder?: (itemId: string, order: number) => void
    onQuickAdd?: (statusKey: string) => void
    onRenameColumn?: (columnId: string, name: string) => void
    onDeleteColumn?: (columnId: string) => void
    selectedIds?: string[]
    onToggleSelect?: (id: string) => void
    // itemId → rótulo do agente que está tocando o item AGORA (em execução)
    agentActive?: { [itemId: string]: string }
}

// KanbanColumn (spec §11.1): coluna configurável; alvo de drop (HTML5 nativo).
// Drop numa coluna diferente muda o status; drop sobre um card da MESMA coluna
// reordena (feature 5).
const KanbanColumn = ({ column, items, usersById, draggingId,
    onOpenItem, onDragStart, onDragEnd, onDropItem, onReorder, onQuickAdd,
    onRenameColumn, onDeleteColumn, selectedIds, onToggleSelect, agentActive }: KanbanColumnProps) => {
    const [over, setOver] = useState(false)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(column.name)

    const ordered = items.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
    const inThisColumn = draggingId ? ordered.some((i) => i.id === draggingId) : false

    const dropAt = (index: number) => {
        setOver(false)
        if (!draggingId) return
        if (inThisColumn) { if (onReorder) onReorder(draggingId, index) }
        else onDropItem(column.statusKey)
    }

    const commitRename = () => {
        setEditing(false)
        const v = name.trim()
        if (v && v !== column.name && onRenameColumn) onRenameColumn(column.id, v)
        else setName(column.name)
    }

    return <section
        className={`mpm-kcol ${over ? "is-dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); dropAt(ordered.length) }}>
        <div className="mpm-kcol__head">
            <span className="mpm-kcol__swatch" style={column.color ? { background: column.color } : undefined} />
            {editing
                ? <input className="mpm-input" style={{ flex: 1, padding: "2px 6px" }} autoFocus value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setName(column.name); setEditing(false) } }} />
                : <span style={{ flex: 1 }}
                    onDoubleClick={() => { if (onRenameColumn) { setName(column.name); setEditing(true) } }}>
                    {column.name}
                </span>}
            <span className="mpm-kcol__count">
                {items.length}{typeof column.wipLimit === "number" && column.wipLimit ? `/${column.wipLimit}` : ""}
            </span>
            {onRenameColumn
                ? <Icon name="pencil" link className="mpm-muted" title="Renomear"
                    onClick={() => { setName(column.name); setEditing(true) }} />
                : null}
            {onDeleteColumn
                ? <Icon name="trash" link className="mpm-muted" title="Excluir coluna"
                    onClick={() => onDeleteColumn(column.id)} />
                : null}
        </div>
        <div className="mpm-kcol__body">
            {ordered.map((it, index) =>
                <WorkItemCard key={it.id}
                    item={it}
                    usersById={usersById}
                    onOpen={onOpenItem}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    dragging={draggingId === it.id}
                    selected={!!selectedIds && selectedIds.indexOf(it.id) >= 0}
                    onToggleSelect={onToggleSelect}
                    agentActor={agentActive ? agentActive[it.id] : undefined}
                    onDropCard={onReorder ? () => dropAt(index) : undefined} />)}
        </div>
        {onQuickAdd
            ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm mpm-kcol__add" onClick={() => onQuickAdd(column.statusKey)}>
                <Icon name="plus" /> Adicionar
            </button>
            : null}
    </section>
}

export default KanbanColumn
