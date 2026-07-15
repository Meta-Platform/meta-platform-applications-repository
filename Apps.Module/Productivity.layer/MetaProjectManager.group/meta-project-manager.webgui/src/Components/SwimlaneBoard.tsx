import * as React from "react"
import { useMemo, useState } from "react"
import { Icon } from "semantic-ui-react"

import { Board, BoardColumn, WorkItem, User } from "../api/types"
import WorkItemCard from "./WorkItemCard"
import { StatusChip } from "./Primitives"
import useAgentActivity from "../Hooks/useAgentActivity"

interface SwimlaneBoardProps {
    board: Board
    items: WorkItem[]
    usersById: { [id: string]: User }
    onOpenItem: (id: string) => void
    onMoveItem?: (itemId: string, statusKey: string) => void
    // criar item nesta coluna, já sob o épico da faixa (epicId undefined = topo)
    onQuickAdd?: (statusKey: string, epicId?: string) => void
    selectedIds?: string[]
    onToggleSelect?: (id: string) => void
}

const NO_EPIC = "__none__"
const DONE = new Set(["done", "archived", "completed"])

// Board em SWIMLANES: um ÚNICO grid — cabeçalho de status no topo e, abaixo, uma
// faixa por épico (linha) com as tarefas nas colunas de status. Como é um grid só,
// as colunas alinham perfeitamente entre todas as faixas. Épicos são cabeçalhos de
// faixa (com progresso), não cards. Soltar um card numa célula muda só o STATUS.
const SwimlaneBoard = ({ board, items, usersById, onOpenItem, onMoveItem, onQuickAdd,
    selectedIds, onToggleSelect }: SwimlaneBoardProps) => {
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [over, setOver] = useState<string | null>(null)   // "laneId::statusKey"
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
    const agentActive = useAgentActivity(board.projectId)

    const byId = useMemo(() => {
        const m: Record<string, WorkItem> = {}
        items.forEach((i) => { m[i.id] = i })
        return m
    }, [items])

    const epicOf = (it: WorkItem): WorkItem | undefined => {
        let cur = it.parentId ? byId[it.parentId] : undefined
        let guard = 0
        while (cur && guard < 30) {
            if (cur.type === "epic") return cur
            cur = cur.parentId ? byId[cur.parentId] : undefined
            guard++
        }
        return undefined
    }

    // Colunas do board + colunas extras para status órfão (nada some).
    const columns: BoardColumn[] = useMemo(() => {
        const base = (board.columns || []).slice().sort((a, b) => a.order - b.order)
        const known = new Set(base.map((c) => c.statusKey))
        const extra: BoardColumn[] = []
        const seen = new Set<string>()
        items.forEach((i) => {
            if (i.type === "epic") return
            if (!known.has(i.statusKey) && !seen.has(i.statusKey)) {
                seen.add(i.statusKey)
                extra.push({ id: `x-${i.statusKey}`, boardId: board.id, name: i.statusKey, statusKey: i.statusKey, order: 999, isDoneColumn: false })
            }
        })
        return [...base, ...extra]
    }, [board, items])

    const { lanes, cardsBy, statusTotals } = useMemo(() => {
        const cardsBy: Record<string, Record<string, WorkItem[]>> = {}
        const statusTotals: Record<string, number> = {}
        let hasOrphan = false
        for (const it of items) {
            if (it.type === "epic") continue
            const laneId = epicOf(it)?.id || NO_EPIC
            if (laneId === NO_EPIC) hasOrphan = true
            if (!cardsBy[laneId]) cardsBy[laneId] = {}
            if (!cardsBy[laneId][it.statusKey]) cardsBy[laneId][it.statusKey] = []
            cardsBy[laneId][it.statusKey].push(it)
            statusTotals[it.statusKey] = (statusTotals[it.statusKey] || 0) + 1
        }
        Object.values(cardsBy).forEach((byStatus) =>
            Object.values(byStatus).forEach((list) => list.sort((a, b) => (a.order || 0) - (b.order || 0))))

        const epics = items.filter((i) => i.type === "epic")
            .sort((a, b) => (a.order || 0) - (b.order || 0) || a.key.localeCompare(b.key))
        const lanes: { id: string; epic?: WorkItem }[] = epics.map((e) => ({ id: e.id, epic: e }))
        if (hasOrphan) lanes.push({ id: NO_EPIC })
        return { lanes, cardsBy, statusTotals }
    }, [items, byId])

    const canDrag = !!onMoveItem
    const handleDrop = (statusKey: string) => {
        if (draggingId && onMoveItem) {
            const it = byId[draggingId]
            if (it && it.statusKey !== statusKey) onMoveItem(draggingId, statusKey)
        }
        setDraggingId(null); setOver(null)
    }

    // Total/concluídos por faixa (para o contador e a barra de progresso).
    const laneStats = (laneId: string): { total: number; done: number; pct: number } => {
        const byStatus = cardsBy[laneId] || {}
        let total = 0, done = 0
        Object.entries(byStatus).forEach(([status, list]) => {
            total += list.length
            if (DONE.has(status)) done += list.length
        })
        return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
    }

    return <div className="mpm-swim" style={{ gridTemplateColumns: `repeat(${columns.length}, var(--mpm-swim-col))` }}>
        {/* Cabeçalho das colunas de status (fixo no topo). */}
        {columns.map((c) =>
            <div key={`h-${c.id}`} className="mpm-swim__col">
                <span className="mpm-kcol__swatch" style={c.color ? { background: c.color } : undefined} />
                <span className="mpm-swim__col-name">{c.name}</span>
                <span className="mpm-kcol__count">{statusTotals[c.statusKey] || 0}</span>
            </div>)}

        {lanes.length === 0
            ? <div className="mpm-muted" style={{ gridColumn: "1 / -1", padding: "var(--mp-space-4)" }}>Nenhum item no board.</div>
            : lanes.map((lane) => {
                const isOpen = !collapsed[lane.id]
                const epic = lane.epic
                const st = laneStats(lane.id)
                return <React.Fragment key={lane.id}>
                    <div className={`mpm-swim__lanehead ${epic ? "" : "is-noepic"}`} style={{ gridColumn: "1 / -1" }}
                        onClick={() => setCollapsed((c) => ({ ...c, [lane.id]: !c[lane.id] }))}>
                        <Icon name={isOpen ? "caret down" : "caret right"} className="mpm-swim__lanecaret" fitted />
                        {epic
                            ? <>
                                <span className="mpm-swim__epicbadge"><Icon name="sitemap" /> ÉPICO</span>
                                <span className="mpm-mono mpm-muted">{epic.key}</span>
                                <span className="mpm-swim__lanetitle" title={epic.title}>{epic.title}</span>
                                <StatusChip status={epic.statusKey} />
                            </>
                            : <span className="mpm-swim__lanetitle mpm-muted"><Icon name="inbox" /> Sem épico</span>}
                        {/* progresso da faixa */}
                        <div className="mpm-swim__progress" title={`${st.done}/${st.total} concluídos`}>
                            <div className="mpm-swim__progress-bar"><span style={{ width: `${st.pct}%` }} /></div>
                            <span className="mpm-swim__progress-num mpm-mono">{st.done}/{st.total}</span>
                        </div>
                        {epic
                            ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm mpm-swim__laneopen" title="Abrir o épico"
                                onClick={(e) => { e.stopPropagation(); onOpenItem(epic.id) }}>abrir</button>
                            : null}
                    </div>

                    {isOpen
                        ? columns.map((c) => {
                            const key = `${lane.id}::${c.statusKey}`
                            const cards = (cardsBy[lane.id] || {})[c.statusKey] || []
                            return <div key={key}
                                className={`mpm-swim__cell ${over === key ? "is-dragover" : ""}`}
                                onDragOver={canDrag ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== key) setOver(key) } : undefined}
                                onDragLeave={canDrag ? () => { if (over === key) setOver(null) } : undefined}
                                onDrop={canDrag ? (e) => { e.preventDefault(); handleDrop(c.statusKey) } : undefined}>
                                {cards.map((it) =>
                                    <WorkItemCard key={it.id}
                                        item={it}
                                        usersById={usersById}
                                        onOpen={onOpenItem}
                                        onDragStart={setDraggingId}
                                        onDragEnd={() => setDraggingId(null)}
                                        dragging={draggingId === it.id}
                                        selected={!!selectedIds && selectedIds.indexOf(it.id) >= 0}
                                        onToggleSelect={onToggleSelect}
                                        agentActor={agentActive ? agentActive[it.id] : undefined}
                                        draggable={canDrag} />)}
                                {onQuickAdd
                                    ? <button className="mpm-swim__add" title={epic ? `Adicionar em ${epic.key} · ${c.name}` : `Adicionar · ${c.name}`}
                                        onClick={() => onQuickAdd(c.statusKey, epic ? epic.id : undefined)}>
                                        <Icon name="plus" />
                                    </button>
                                    : null}
                            </div>
                        })
                        : null}
                </React.Fragment>
            })}
    </div>
}

export default SwimlaneBoard
