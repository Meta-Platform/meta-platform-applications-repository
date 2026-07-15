import * as React from "react"

import { WorkItem, User } from "../api/types"
import { TypeBadge, PriorityBadge, ValueBadge, Avatar, ItemMeta } from "./Primitives"

interface WorkItemCardProps {
    item: WorkItem
    usersById: { [id: string]: User }
    onOpen: (id: string) => void
    onDragStart: (id: string) => void
    onDragEnd: () => void
    dragging?: boolean
    selected?: boolean
    onToggleSelect?: (id: string) => void
    // rótulo do agente que está tocando o item AGORA (ao vivo) → estado "em execução"
    agentActor?: string
    // drop de outro card sobre este (reordenar dentro da coluna)
    onDropCard?: () => void
    // Projeto arquivado: card não arrastável (leitura).
    draggable?: boolean
}

// WorkItemCard (spec §11.1): card de item no Kanban, com badges, drag nativo,
// seleção (feature 4) e alvo de reorder (feature 5).
const WorkItemCard = ({ item, usersById, onOpen, onDragStart, onDragEnd, dragging,
    selected, onToggleSelect, agentActor, onDropCard, draggable = true }: WorkItemCardProps) => {
    const assignee = item.assigneeUserId ? usersById[item.assigneeUserId] : undefined
    const executing = !!agentActor
    return <div
        data-item-id={item.id}
        data-priority={item.priority}
        className={`mpm-witem ${dragging ? "is-dragging" : ""} ${selected ? "is-selected" : ""} ${executing ? "is-executing" : ""}`}
        draggable={draggable}
        onDragStart={draggable ? (e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); onDragStart(item.id) } : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
        onDragOver={onDropCard ? (e) => { e.preventDefault(); e.stopPropagation() } : undefined}
        onDrop={onDropCard ? (e) => { e.preventDefault(); e.stopPropagation(); onDropCard() } : undefined}
        onClick={() => onOpen(item.id)}>
        <div className="mpm-witem__top">
            {onToggleSelect
                ? <input type="checkbox" checked={!!selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleSelect(item.id)} />
                : null}
            <TypeBadge type={item.type} />
            <PriorityBadge priority={item.priority} />
            <span className="mpm-witem__key">{item.key}</span>
        </div>
        <div className="mpm-witem__title">{item.title}</div>
        {executing
            ? <div className="mpm-witem__exec" title={`Agente trabalhando neste item agora (${agentActor})`}>
                <span className="mpm-exec-spinner" aria-hidden="true"><i /><i /><i /></span>
                <span className="mpm-witem__exec-label">em execução</span>
                <span className="mpm-witem__exec-actor mpm-mono">{agentActor}</span>
            </div>
            : null}
        <div className="mpm-row">
            <ItemMeta item={item} />
            <ValueBadge value={item.value} />
            <span style={{ flex: 1 }} />
            <Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} />
        </div>
    </div>
}

export default WorkItemCard
