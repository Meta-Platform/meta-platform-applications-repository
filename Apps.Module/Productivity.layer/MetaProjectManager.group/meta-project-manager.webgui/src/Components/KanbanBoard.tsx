import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { Board, WorkItem, User } from "../api/types"
import KanbanColumn from "./KanbanColumn"
import useAgentActivity from "../Hooks/useAgentActivity"

interface KanbanBoardProps {
    board: Board
    items: WorkItem[]
    usersById: { [id: string]: User }
    onOpenItem: (id: string) => void
    // ao soltar num alvo: chama SetItemStatus com o statusKey da coluna destino.
    // Ausente num projeto arquivado (leitura): o quadro não aceita mover cards.
    onMoveItem?: (itemId: string, statusKey: string) => void
    onReorderItem?: (itemId: string, order: number) => void
    onQuickAdd?: (statusKey: string) => void
    onAddColumn?: (name: string) => void
    onRenameColumn?: (columnId: string, name: string) => void
    onDeleteColumn?: (columnId: string) => void
    selectedIds?: string[]
    onToggleSelect?: (id: string) => void
}

// KanbanBoard (spec §11.1): quadro com colunas configuráveis + drag-and-drop
// nativo entre colunas. Itens sem coluna correspondente caem numa coluna
// virtual "Sem coluna".
const KanbanBoard = ({ board, items, usersById, onOpenItem, onMoveItem, onReorderItem, onQuickAdd,
    onAddColumn, onRenameColumn, onDeleteColumn, selectedIds, onToggleSelect }: KanbanBoardProps) => {
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [newColumn, setNewColumn] = useState("")
    // Itens que um agente está tocando AGORA (ao vivo) → card pulsa "em execução".
    const agentActive = useAgentActivity(board.projectId)

    const commitAddColumn = () => {
        const v = newColumn.trim()
        if (v && onAddColumn) { onAddColumn(v); setNewColumn("") }
    }

    const columns = (board.columns || []).slice().sort((a, b) => a.order - b.order)
    const knownStatuses = new Set(columns.map((c) => c.statusKey))

    const byStatus = (statusKey: string) => items.filter((i) => i.statusKey === statusKey)
    const orphans = items.filter((i) => !knownStatuses.has(i.statusKey))

    // Cards só são arrastáveis se houver como mover ou reordenar (leitura desliga).
    const canDrag = !!onMoveItem || !!onReorderItem

    const handleDrop = (statusKey: string) => {
        if (draggingId && onMoveItem) {
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
                onReorder={onReorderItem}
                onQuickAdd={onQuickAdd}
                onRenameColumn={onRenameColumn}
                onDeleteColumn={onDeleteColumn}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                agentActive={agentActive}
                draggable={canDrag} />)}
        {orphans.length > 0
            ? <KanbanColumn
                column={{ id: "__orphans__", boardId: board.id, name: "Sem coluna", statusKey: "__orphans__", order: 999, isDoneColumn: false }}
                items={orphans}
                usersById={usersById}
                draggingId={draggingId}
                onOpenItem={onOpenItem}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onDropItem={() => setDraggingId(null)}
                draggable={canDrag} />
            : null}
        {onAddColumn
            ? <section className="mpm-kcol" style={{ background: "transparent", borderStyle: "dashed" }}>
                <div className="mpm-kcol__body">
                    <input className="mpm-input" placeholder="Nova coluna..." value={newColumn}
                        onChange={(e) => setNewColumn(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitAddColumn() }} />
                    <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" disabled={!newColumn.trim()} onClick={commitAddColumn}>
                        <Icon name="plus" /> Adicionar coluna
                    </button>
                </div>
            </section>
            : null}
    </div>
}

export default KanbanBoard
