import * as React from "react"
import { useState } from "react"

import { Board, WorkItem, User } from "../api/types"
import KanbanColumn from "./KanbanColumn"

interface KanbanBoardProps {
    board: Board
    items: WorkItem[]
    usersById: { [id: string]: User }
    onOpenItem: (id: string) => void
    // ao soltar num alvo: chama SetItemStatus com o statusKey da coluna destino
    onMoveItem: (itemId: string, statusKey: string) => void
    onQuickAdd?: (statusKey: string) => void
}

// KanbanBoard (spec §11.1): quadro com colunas configuráveis + drag-and-drop
// nativo entre colunas. Itens sem coluna correspondente caem numa coluna
// virtual "Sem coluna".
const KanbanBoard = ({ board, items, usersById, onOpenItem, onMoveItem, onQuickAdd }: KanbanBoardProps) => {
    const [draggingId, setDraggingId] = useState<string | null>(null)

    const columns = (board.columns || []).slice().sort((a, b) => a.order - b.order)
    const knownStatuses = new Set(columns.map((c) => c.statusKey))

    const byStatus = (statusKey: string) => items.filter((i) => i.statusKey === statusKey)
    const orphans = items.filter((i) => !knownStatuses.has(i.statusKey))

    const handleDrop = (statusKey: string) => {
        if (draggingId) {
            const it = items.find((i) => i.id === draggingId)
            if (it && it.statusKey !== statusKey) onMoveItem(draggingId, statusKey)
        }
        setDraggingId(null)
    }

    return <div className="mpm-kanban">
        {columns.map((col) =>
            <KanbanColumn key={col.id}
                column={col}
                items={byStatus(col.statusKey)}
                usersById={usersById}
                draggingId={draggingId}
                onOpenItem={onOpenItem}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onDropItem={handleDrop}
                onQuickAdd={onQuickAdd} />)}
        {orphans.length > 0
            ? <KanbanColumn
                column={{ id: "__orphans__", boardId: board.id, name: "Sem coluna", statusKey: "__orphans__", order: 999, isDoneColumn: false }}
                items={orphans}
                usersById={usersById}
                draggingId={draggingId}
                onOpenItem={onOpenItem}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onDropItem={() => setDraggingId(null)} />
            : null}
    </div>
}

export default KanbanBoard
