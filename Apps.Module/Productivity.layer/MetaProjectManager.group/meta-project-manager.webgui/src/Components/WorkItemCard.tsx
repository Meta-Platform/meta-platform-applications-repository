import * as React from "react"

import { WorkItem, User } from "../api/types"
import { TypeBadge, PriorityBadge, Avatar, ItemMeta } from "./Primitives"

interface WorkItemCardProps {
    item: WorkItem
    usersById: { [id: string]: User }
    onOpen: (id: string) => void
    onDragStart: (id: string) => void
    onDragEnd: () => void
    dragging?: boolean
}

// WorkItemCard (spec §11.1): card de item no Kanban, com badges e drag nativo.
const WorkItemCard = ({ item, usersById, onOpen, onDragStart, onDragEnd, dragging }: WorkItemCardProps) => {
    const assignee = item.assigneeUserId ? usersById[item.assigneeUserId] : undefined
    return <div
        className={`mpm-witem ${dragging ? "is-dragging" : ""}`}
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
        <div className="mpm-row">
            <ItemMeta item={item} />
            <span style={{ flex: 1 }} />
            <Avatar user={assignee} name={assignee ? assignee.displayName : "não atribuído"} />
        </div>
    </div>
}

export default WorkItemCard
