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
    onQuickAdd?: (statusKey: string) => void
}

// KanbanColumn (spec §11.1): coluna configurável; alvo de drop (HTML5 nativo).
const KanbanColumn = ({ column, items, usersById, draggingId,
    onOpenItem, onDragStart, onDragEnd, onDropItem, onQuickAdd }: KanbanColumnProps) => {
    const [over, setOver] = useState(false)

    return <section
        className={`mpm-kcol ${over ? "is-dragover" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!over) setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onDropItem(column.statusKey) }}>
        <div className="mpm-kcol__head">
            <span className="mpm-kcol__swatch" style={column.color ? { background: column.color } : undefined} />
            <span>{column.name}</span>
            <span className="mpm-kcol__count">
                {items.length}{typeof column.wipLimit === "number" && column.wipLimit ? `/${column.wipLimit}` : ""}
            </span>
        </div>
        <div className="mpm-kcol__body">
            {items.map((it) =>
                <WorkItemCard key={it.id}
                    item={it}
                    usersById={usersById}
                    onOpen={onOpenItem}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    dragging={draggingId === it.id} />)}
        </div>
        {onQuickAdd
            ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm mpm-kcol__add" onClick={() => onQuickAdd(column.statusKey)}>
                <Icon name="plus" /> Adicionar
            </button>
            : null}
    </section>
}

export default KanbanColumn
