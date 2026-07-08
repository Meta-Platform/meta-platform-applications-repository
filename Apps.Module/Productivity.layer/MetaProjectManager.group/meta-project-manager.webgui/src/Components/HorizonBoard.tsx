import * as React from "react"
import { useState } from "react"

import { HorizonBoard as HorizonBoardData, WorkItem, User } from "../api/types"
import { horizonLabel } from "../Utils/format"
import { TypeBadge, PriorityBadge, ValueBadge, EffortBadge, AreaBadge, Avatar, ItemMeta } from "./Primitives"

// Colunas exibidas no modo "por horizonte" (ordem de fluxo de trabalho).
const COLUMNS: string[] = ["inbox", "now", "next", "later", "maybe", "archived", "unassigned"]

interface HorizonBoardProps {
    data: HorizonBoardData
    usersById: { [id: string]: User }
    onOpenItem: (id: string) => void
    // ao soltar numa coluna: chama UpdateItem com o novo horizon (unassigned -> "")
    onMoveHorizon: (itemId: string, horizon: string) => void
}

const HCard = ({ item, usersById, onOpen, onDragStart, onDragEnd, dragging }:
    { item: WorkItem; usersById: { [id: string]: User }; onOpen: (id: string) => void;
      onDragStart: (id: string) => void; onDragEnd: () => void; dragging: boolean }) => {
    const assignee = item.assigneeUserId ? usersById[item.assigneeUserId] : undefined
    return <div className={`mpm-witem ${dragging ? "is-dragging" : ""}`}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); onDragStart(item.id) }}
        onDragEnd={onDragEnd}
        onClick={() => onOpen(item.id)}>
        <div className="mpm-witem__top">
            <TypeBadge type={item.type} />
            <PriorityBadge priority={item.priority} />
            <span className="mpm-witem__key">{item.key}</span>
        </div>
        <div className="mpm-witem__title">{item.title}</div>
        <div className="mpm-row mpm-wrap">
            <ValueBadge value={item.value} />
            <EffortBadge effort={item.effort} />
            <AreaBadge area={item.area} />
        </div>
        <div className="mpm-row">
            <ItemMeta item={item} />
            <span style={{ flex: 1 }} />
            <Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} />
        </div>
    </div>
}

// HorizonBoard (Fase 2): roadmap por horizonte com drag-and-drop nativo entre
// colunas; soltar chama UpdateItem com o novo horizon.
const HorizonBoard = ({ data, usersById, onOpenItem, onMoveHorizon }: HorizonBoardProps) => {
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [over, setOver] = useState<string | null>(null)

    const itemsOf = (key: string): WorkItem[] => (data as any)[key] || []

    const handleDrop = (key: string) => {
        if (draggingId) {
            // "unassigned" limpa o horizon
            const target = key === "unassigned" ? "" : key
            onMoveHorizon(draggingId, target)
        }
        setDraggingId(null); setOver(null)
    }

    return <div className="mpm-kanban">
        {COLUMNS.map((key) => {
            const items = itemsOf(key)
            return <section key={key}
                className={`mpm-kcol ${over === key ? "is-dragover" : ""}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== key) setOver(key) }}
                onDragLeave={() => { if (over === key) setOver(null) }}
                onDrop={(e) => { e.preventDefault(); handleDrop(key) }}>
                <div className="mpm-kcol__head">
                    <span>{horizonLabel(key)}</span>
                    <span className="mpm-kcol__count">{items.length}</span>
                </div>
                <div className="mpm-kcol__body">
                    {items.map((it) =>
                        <HCard key={it.id}
                            item={it}
                            usersById={usersById}
                            onOpen={onOpenItem}
                            onDragStart={setDraggingId}
                            onDragEnd={() => setDraggingId(null)}
                            dragging={draggingId === it.id} />)}
                </div>
            </section>
        })}
    </div>
}

export default HorizonBoard
