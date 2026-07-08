import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import {
    WorkItem, User, Milestone, Sprint,
    WORK_ITEM_TYPES, HORIZONS, CLARITY_STATES, EFFORTS, ITEM_VALUES, AREA_SUGGESTIONS
} from "../api/types"
import { horizonLabel } from "../Utils/format"
import { TypeBadge, PriorityBadge, StatusChip, Avatar, Loading, ErrorBanner } from "./Primitives"
import AttachmentPanel from "./AttachmentPanel"
import CommentTimeline from "./CommentTimeline"
import AuditTimeline from "./AuditTimeline"
import Markdown from "./Markdown"

const PRIORITIES = ["none", "low", "medium", "high", "urgent"]

interface StatusOption { statusKey: string; name: string }

interface WorkItemInspectorProps {
    itemId: string
    projectId?: string
    users: User[]
    statusOptions?: StatusOption[]
    onClose: () => void
    onChanged?: () => void
}

// WorkItemInspector (spec §11.1): painel lateral completo de um work item.
const WorkItemInspector = ({ itemId, projectId, users, statusOptions, onClose, onChanged }: WorkItemInspectorProps) => {
    const api = useApi()
    const [item, setItem] = useState<WorkItem | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [checkDraft, setCheckDraft] = useState("")
    const [critDraft, setCritDraft] = useState("")
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [sprints, setSprints] = useState<Sprint[]>([])

    const usersById: { [id: string]: User } = {}
    users.forEach((u) => { usersById[u.id] = u })

    const load = () => api.items.get(itemId)
        .then((it) => setItem(it))
        .catch((e) => setError(e.message))

    useEffect(() => { setItem(null); setError(null); load() }, [itemId])

    // milestones/sprints do projeto para os seletores de planejamento
    useEffect(() => {
        if (!projectId) { setMilestones([]); setSprints([]); return }
        api.planning.listMilestones(projectId).then((l) => setMilestones(l || [])).catch(() => setMilestones([]))
        api.planning.listSprints(projectId).then((l) => setSprints(l || [])).catch(() => setSprints([]))
    }, [projectId, api])

    const patch = async (fn: () => Promise<any>) => {
        setError(null)
        try { await fn(); await load(); onChanged && onChanged() }
        catch (e: any) { setError(e.message) }
    }

    if (error && !item)
        return <aside className="mpm-inspector">
            <div className="mpm-inspector__head">
                <strong style={{ flex: 1 }}>Item</strong>
                <span className="mpm-iconbtn" onClick={onClose}><Icon name="close" /></span>
            </div>
            <div className="mpm-inspector__body"><ErrorBanner error={error} /></div>
        </aside>

    if (!item)
        return <aside className="mpm-inspector">
            <div className="mpm-inspector__head">
                <strong style={{ flex: 1 }}>Item</strong>
                <span className="mpm-iconbtn" onClick={onClose}><Icon name="close" /></span>
            </div>
            <div className="mpm-inspector__body"><Loading /></div>
        </aside>

    const pid = projectId || item.projectId

    return <aside className="mpm-inspector">
        <div className="mpm-inspector__head">
            <span className="mpm-mono mpm-muted">{item.key}</span>
            <TypeBadge type={item.type} />
            <span style={{ flex: 1 }} />
            <span className="mpm-iconbtn" title="Excluir" onClick={() => patch(async () => {
                await api.items.remove(item.id); onClose()
            })}><Icon name="trash" /></span>
            <span className="mpm-iconbtn" onClick={onClose}><Icon name="close" /></span>
        </div>

        <div className="mpm-inspector__body">
            <ErrorBanner error={error} />

            <input
                className="mpm-input"
                style={{ fontSize: "var(--mp-text-lg)", fontWeight: 700 }}
                defaultValue={item.title}
                key={`title-${item.id}-${item.updatedAt || ""}`}
                onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== item.title) patch(() => api.items.update(item.id, { title: v }))
                }} />

            <div className="mpm-row mpm-wrap">
                <div className="mpm-field">
                    <span className="mpm-field__label">Tipo</span>
                    <select className="mpm-inline-select" value={item.type}
                        onChange={(e) => patch(() => api.items.update(item.id, { type: e.target.value }))}>
                        {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Status</span>
                    <select className="mpm-inline-select" value={item.statusKey}
                        onChange={(e) => patch(() => api.items.setStatus(item.id, e.target.value))}>
                        {(statusOptions && statusOptions.length > 0
                            ? statusOptions
                            : [{ statusKey: item.statusKey, name: item.statusKey }]).map((s) =>
                            <option key={s.statusKey} value={s.statusKey}>{s.name}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Prioridade</span>
                    <select className="mpm-inline-select" value={item.priority}
                        onChange={(e) => patch(() => api.items.update(item.id, { priority: e.target.value }))}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Responsável</span>
                    <select className="mpm-inline-select" value={item.assigneeUserId || ""}
                        onChange={(e) => patch(() => api.items.update(item.id, { assignee: e.target.value }))}>
                        <option value="">— não atribuído —</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Milestone</span>
                    <select className="mpm-inline-select" value={item.milestoneId || ""}
                        onChange={(e) => patch(() => api.planning.assignItemPlanning(item.id, { milestone: e.target.value || "none" }))}>
                        <option value="">— nenhum —</option>
                        {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Sprint</span>
                    <select className="mpm-inline-select" value={item.sprintId || ""}
                        onChange={(e) => patch(() => api.planning.assignItemPlanning(item.id, { sprint: e.target.value || "none" }))}>
                        <option value="">— nenhum —</option>
                        {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="mpm-row mpm-wrap">
                <div className="mpm-field">
                    <span className="mpm-field__label">Horizonte</span>
                    <select className="mpm-inline-select" value={item.horizon || ""}
                        onChange={(e) => patch(() => api.items.update(item.id, { horizon: e.target.value }))}>
                        <option value="">—</option>
                        {HORIZONS.map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Clareza</span>
                    <select className="mpm-inline-select" value={item.clarityState || ""}
                        onChange={(e) => patch(() => api.items.update(item.id, { clarityState: e.target.value }))}>
                        <option value="">—</option>
                        {CLARITY_STATES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Esforço</span>
                    <select className="mpm-inline-select" value={item.effort || ""}
                        onChange={(e) => patch(() => api.items.update(item.id, { effort: e.target.value }))}>
                        <option value="">—</option>
                        {EFFORTS.map((ef) => <option key={ef} value={ef}>{ef.toUpperCase()}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Valor</span>
                    <select className="mpm-inline-select" value={item.value || ""}
                        onChange={(e) => patch(() => api.items.update(item.id, { value: e.target.value }))}>
                        <option value="">—</option>
                        {ITEM_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Área</span>
                    <input className="mpm-inline-select" list="mpm-area-list" defaultValue={item.area || ""}
                        key={`area-${item.id}-${item.updatedAt || ""}`}
                        onBlur={(e) => { if (e.target.value !== (item.area || "")) patch(() => api.items.update(item.id, { area: e.target.value })) }} />
                    <datalist id="mpm-area-list">
                        {AREA_SUGGESTIONS.map((a) => <option key={a} value={a} />)}
                    </datalist>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Origem da ideia</span>
                    <input className="mpm-inline-select" defaultValue={item.ideaOrigin || ""}
                        key={`origin-${item.id}-${item.updatedAt || ""}`}
                        onBlur={(e) => { if (e.target.value !== (item.ideaOrigin || "")) patch(() => api.items.update(item.id, { ideaOrigin: e.target.value })) }} />
                </div>
            </div>

            {item.blockedReason
                ? <div className="mpm-error-banner"><Icon name="ban" /> Bloqueado: {item.blockedReason}</div>
                : null}

            <div className="mpm-field">
                <span className="mpm-field__label">Descrição (markdown)</span>
                <textarea className="mpm-textarea" defaultValue={item.description || ""}
                    key={`desc-${item.id}-${item.updatedAt || ""}`}
                    onBlur={(e) => {
                        if (e.target.value !== (item.description || ""))
                            patch(() => api.items.update(item.id, { description: e.target.value }))
                    }} />
                {item.description && item.description.trim()
                    ? <>
                        <span className="mpm-field__label" style={{ marginTop: "var(--mp-space-2)" }}>Pré-visualização</span>
                        <Markdown>{item.description}</Markdown>
                    </>
                    : null}
            </div>

            <div className="mpm-col">
                <div className="mpm-section-title"><Icon name="check circle outline" /> Critérios de aceite</div>
                <div className="mpm-checklist">
                    {(item.acceptanceCriteria || []).map((a) =>
                        <div key={a.id} className={`mpm-checklist__item ${a.met ? "is-done" : ""}`}>
                            <Icon name={a.met ? "check square" : "square outline"} link
                                onClick={() => patch(() => api.items.updateAcceptanceCriteria(a.id, { met: !a.met }))} />
                            <span style={{ flex: 1 }}>{a.text}</span>
                            <Icon name="trash" link className="mpm-muted"
                                onClick={() => patch(() => api.items.removeAcceptanceCriteria(a.id))} />
                        </div>)}
                </div>
                <div className="mpm-row">
                    <input className="mpm-input" placeholder="Adicionar critério + Enter" value={critDraft}
                        onChange={(e) => setCritDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && critDraft.trim()) {
                                const text = critDraft.trim(); setCritDraft("")
                                patch(() => api.items.addAcceptanceCriteria(item.id, text))
                            }
                        }} />
                </div>
            </div>

            <div className="mpm-col">
                <div className="mpm-section-title"><Icon name="tasks" /> Checklist</div>
                <div className="mpm-checklist">
                    {(item.checklist || []).map((c) =>
                        <div key={c.id} className={`mpm-checklist__item ${c.done ? "is-done" : ""}`}>
                            <Icon name={c.done ? "check square" : "square outline"} link
                                onClick={() => patch(() => api.items.updateChecklistItem(c.id, { done: !c.done }))} />
                            <span style={{ flex: 1 }}>{c.text}</span>
                            <Icon name="trash" link className="mpm-muted"
                                onClick={() => patch(() => api.items.removeChecklistItem(c.id))} />
                        </div>)}
                </div>
                <div className="mpm-row">
                    <input className="mpm-input" placeholder="Adicionar item + Enter" value={checkDraft}
                        onChange={(e) => setCheckDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && checkDraft.trim()) {
                                const text = checkDraft.trim(); setCheckDraft("")
                                patch(() => api.items.addChecklistItem(item.id, text))
                            }
                        }} />
                </div>
            </div>

            {item.children && item.children.length > 0
                ? <div className="mpm-col">
                    <div className="mpm-section-title"><Icon name="sitemap" /> Subtarefas ({item.children.length})</div>
                    {item.children.map((c) =>
                        <div key={c.id} className="mpm-row">
                            <span className="mpm-mono mpm-muted">{c.key}</span>
                            <StatusChip status={c.statusKey} />
                            <span>{c.title}</span>
                        </div>)}
                </div>
                : null}

            {item.links && item.links.length > 0
                ? <div className="mpm-col">
                    <div className="mpm-section-title"><Icon name="linkify" /> Links</div>
                    {item.links.map((l) =>
                        <div key={l.id} className="mpm-row">
                            <span className="mpm-chip mpm-chip--neutral">{l.relation}</span>
                            <span className="mpm-mono mpm-muted">{l.targetItemId}</span>
                        </div>)}
                </div>
                : null}

            <AttachmentPanel itemId={item.id} />
            <CommentTimeline itemId={item.id} usersById={usersById} />
            <AuditTimeline projectId={pid} entityId={item.id} />
        </div>
    </aside>
}

export default WorkItemInspector
