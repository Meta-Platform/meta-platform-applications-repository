import * as React from "react"
import { Icon } from "semantic-ui-react"

import { User, Milestone, Sprint, HORIZONS } from "../api/types"
import { horizonLabel } from "../Utils/format"

const PRIORITIES = ["none", "low", "medium", "high", "urgent"]

interface StatusOption { statusKey: string; name: string }

interface BulkActionBarProps {
    count: number
    users: User[]
    statusOptions: StatusOption[]
    milestones: Milestone[]
    sprints: Sprint[]
    onSetStatus: (status: string) => void
    onSetPriority: (priority: string) => void
    onAssign: (userId: string) => void
    onSetHorizon: (horizon: string) => void
    onSetMilestone: (milestoneId: string) => void
    onSetSprint: (sprintId: string) => void
    onDelete: () => void
    onClear: () => void
}

// BulkActionBar (feature 4): ações em lote sobre os itens selecionados. Cada
// select dispara a ação e volta ao placeholder (as chamadas são por item).
const BulkActionBar = (p: BulkActionBarProps) => {
    const pick = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value
        if (v !== "") fn(v)
        e.target.value = ""
    }

    return <div className="mpm-bulkbar">
        <span className="mpm-row"><Icon name="check square" /> <strong>{p.count}</strong> selecionado(s)</span>
        <span className="mpm-toolbar__spacer" />

        <select className="mpm-inline-select" value="" onChange={pick(p.onSetStatus)}>
            <option value="">Status…</option>
            {p.statusOptions.map((s) => <option key={s.statusKey} value={s.statusKey}>{s.name}</option>)}
        </select>
        <select className="mpm-inline-select" value="" onChange={pick(p.onSetPriority)}>
            <option value="">Prioridade…</option>
            {PRIORITIES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
        </select>
        <select className="mpm-inline-select" value="" onChange={pick(p.onAssign)}>
            <option value="">Responsável…</option>
            <option value="__none__">— remover —</option>
            {p.users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </select>
        <select className="mpm-inline-select" value="" onChange={pick(p.onSetHorizon)}>
            <option value="">Horizonte…</option>
            {HORIZONS.map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
        </select>
        <select className="mpm-inline-select" value="" onChange={pick(p.onSetMilestone)}>
            <option value="">Milestone…</option>
            <option value="none">— remover —</option>
            {p.milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="mpm-inline-select" value="" onChange={pick(p.onSetSprint)}>
            <option value="">Sprint…</option>
            <option value="none">— remover —</option>
            {p.sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button className="mpm-btn mpm-btn--danger mpm-btn--sm" onClick={p.onDelete}><Icon name="trash" /> Excluir</button>
        <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" onClick={p.onClear}><Icon name="close" /> Limpar</button>
    </div>
}

export default BulkActionBar
