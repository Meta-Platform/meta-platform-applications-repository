import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import {
    WorkItem, User, Milestone, Sprint, ActivityNote,
    WORK_ITEM_TYPES, HORIZONS, CLARITY_STATES, EFFORTS, ITEM_VALUES, AREA_SUGGESTIONS
} from "../api/types"
import { horizonLabel, formatDateTime } from "../Utils/format"
import { TypeBadge, StatusChip, Loading, ErrorBanner } from "./Primitives"
import AttachmentPanel from "./AttachmentPanel"
import CommentTimeline from "./CommentTimeline"
import AuditTimeline from "./AuditTimeline"
import LinkPanel from "./LinkPanel"
import SoftwareContextSection from "./SoftwareContextSection"
import DescriptionEditor from "./DescriptionEditor"
import Markdown from "./Markdown"
import ConfirmActionModal from "./ConfirmActionModal"

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

// Abas do modal de item (spec §8.1): evita uma rolagem única gigante.
type TabKey = "resumo" | "descricao" | "criterios" | "checklist" | "vinculos" | "anexos" | "atividade" | "auditoria"
const TABS: { key: TabKey; label: string; icon: any; hint: string }[] = [
    { key: "descricao", label: "Descrição",  icon: "align left",           hint: "Descrição em markdown (negrito, itálico, sublinhado)" },
    { key: "resumo",    label: "Resumo",     icon: "info circle",          hint: "Campos principais: tipo, status, prioridade, responsável, planejamento" },
    { key: "criterios", label: "Critérios",  icon: "check circle outline", hint: "Critérios de aceite (Definition of Done)" },
    { key: "checklist", label: "Checklist",  icon: "tasks",                hint: "Sub-passos marcáveis do item" },
    { key: "vinculos",  label: "Vínculos",   icon: "linkify",              hint: "Dependências, bloqueios e relações com outros itens" },
    { key: "anexos",    label: "Anexos",     icon: "paperclip",            hint: "Arquivos, links e mídias" },
    { key: "atividade", label: "Atividade",  icon: "comments",             hint: "Comentários e anotações (inclusive do usuario-desktop)" },
    { key: "auditoria", label: "Auditoria",  icon: "history",              hint: "Timeline técnica imutável: quem mudou o quê e quando" }
]

// Anotações de atividade do item (humanas / usuario-desktop). Distintas de comentários.
const ItemNotes = ({ itemId }: { itemId: string }) => {
    const api = useApi()
    const [notes, setNotes] = useState<ActivityNote[]>([])
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | null>(null)

    const load = () => api.activity.listNotes({ item: itemId }).then((l) => setNotes(l || [])).catch(() => setNotes([]))
    useEffect(() => { load() }, [itemId])

    const add = async () => {
        if (!draft.trim()) return
        try { await api.activity.addNote({ item: itemId, text: draft.trim() }); setDraft(""); await load() }
        catch (e: any) { setError(e.message) }
    }

    return <div className="mpm-col">
        <div className="mpm-section-title" title="Anotações manuais do ambiente desktop; agentes conseguem lê-las">
            <Icon name="sticky note" /> Anotações ({notes.length})
        </div>
        <ErrorBanner error={error} />
        <div className="mpm-row" style={{ gap: "var(--mp-space-2)" }}>
            <input className="mpm-input" style={{ flex: 1 }} value={draft}
                placeholder="Anotar algo sobre este item…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") add() }} />
            <button className="mpm-btn mpm-btn--sm mpm-btn--primary" disabled={!draft.trim()} onClick={add}>
                <Icon name="plus" /> Anotar
            </button>
        </div>
        {notes.map((n) =>
            <div key={n.id} className="mpm-audit__note">
                <Icon name="sticky note outline" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div>{n.body}</div>
                    <div className="mpm-mono mpm-muted" style={{ fontSize: "11px" }}>
                        {n.source} · {formatDateTime(n.createdAt)}
                    </div>
                </div>
            </div>)}
    </div>
}

// WorkItemInspector (spec §11.1 / §8.1): modal de item organizado em ABAS.
const WorkItemInspector = ({ itemId, projectId, users, statusOptions, onClose, onChanged }: WorkItemInspectorProps) => {
    const api = useApi()
    const [item, setItem] = useState<WorkItem | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [checkDraft, setCheckDraft] = useState("")
    const [critDraft, setCritDraft] = useState("")
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [sprints, setSprints] = useState<Sprint[]>([])
    // Descrição primeiro: é o que o usuário quer ler/editar ao abrir um item.
    const [tab, setTab] = useState<TabKey>("descricao")
    // Resumo "clean": por padrão só campos PREENCHIDOS; o toggle revela os vazios.
    const [showEmptyFields, setShowEmptyFields] = useState(false)
    // A descrição abre em LEITURA (ocupando o modal). "Editar" liga o editor.
    const [editingDesc, setEditingDesc] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const usersById: { [id: string]: User } = {}
    users.forEach((u) => { usersById[u.id] = u })

    const load = () => api.items.get(itemId)
        .then((it) => setItem(it))
        .catch((e) => setError(e.message))

    useEffect(() => { setItem(null); setError(null); setTab("descricao"); setShowEmptyFields(false); setEditingDesc(false); load() }, [itemId])

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

    const doDelete = async () => {
        if (!item) return
        setDeleting(true); setError(null)
        try { await api.items.remove(item.id); onChanged && onChanged(); onClose() }
        catch (e: any) { setError(e.message); setDeleting(false); setConfirmDelete(false) }
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

    // Resumo clean: campo opcional só aparece se PREENCHIDO (ou se o usuário pedir
    // para ver os vazios). Tipo/Status/Prioridade são sempre exibidos.
    const optional = (filled: boolean, node: React.ReactNode) =>
        (filled || showEmptyFields) ? node : null
    const hiddenCount = [
        item.assigneeUserId, item.milestoneId, item.sprintId, item.horizon,
        item.clarityState, item.effort, item.value, item.area, item.ideaOrigin
    ].filter((v) => !v).length

    const summaryTab = <>
        <div className="mpm-row" style={{ justifyContent: "flex-end" }}>
            {hiddenCount > 0 || showEmptyFields
                ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm"
                    title="Mostra também os campos ainda não preenchidos"
                    onClick={() => setShowEmptyFields((v) => !v)}>
                    <Icon name={showEmptyFields ? "eye slash" : "eye"} />
                    {showEmptyFields ? "Ocultar campos vazios" : `Mostrar campos vazios (${hiddenCount})`}
                </button>
                : null}
        </div>
        <div className="mpm-inspector__grid">
            <div className="mpm-field">
                <span className="mpm-field__label" title="Natureza do trabalho: epic, feature, história, tarefa, bug…">Tipo</span>
                <select className="mpm-inline-select" value={item.type}
                    onChange={(e) => patch(() => api.items.update(item.id, { type: e.target.value }))}>
                    {WORK_ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div className="mpm-field">
                <span className="mpm-field__label" title="Onde o item está no fluxo (coluna do board)">Status</span>
                <select className="mpm-inline-select" value={item.statusKey}
                    onChange={(e) => patch(() => api.items.setStatus(item.id, e.target.value))}>
                    {(statusOptions && statusOptions.length > 0
                        ? statusOptions
                        : [{ statusKey: item.statusKey, name: item.statusKey }]).map((s) =>
                        <option key={s.statusKey} value={s.statusKey}>{s.name}</option>)}
                </select>
            </div>
            <div className="mpm-field">
                <span className="mpm-field__label" title="Quão urgente é fazer">Prioridade</span>
                <select className="mpm-inline-select" value={item.priority}
                    onChange={(e) => patch(() => api.items.update(item.id, { priority: e.target.value }))}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            {optional(!!item.assigneeUserId, <div className="mpm-field">
                <span className="mpm-field__label" title="Quem é responsável (humano ou agente)">Responsável</span>
                <select className="mpm-inline-select" value={item.assigneeUserId || ""}
                    onChange={(e) => patch(() => api.items.update(item.id, { assignee: e.target.value }))}>
                    <option value="">— não atribuído —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                </select>
            </div>)}
            {optional(!!item.milestoneId, <div className="mpm-field">
                <span className="mpm-field__label" title="Alvo de entrega com data (marco/release)">Milestone</span>
                <select className="mpm-inline-select" value={item.milestoneId || ""}
                    onChange={(e) => patch(() => api.planning.assignItemPlanning(item.id, { milestone: e.target.value || "none" }))}>
                    <option value="">— nenhum —</option>
                    {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
            </div>)}
            {optional(!!item.sprintId, <div className="mpm-field">
                <span className="mpm-field__label" title="Janela de tempo fixa (iteração)">Sprint</span>
                <select className="mpm-inline-select" value={item.sprintId || ""}
                    onChange={(e) => patch(() => api.planning.assignItemPlanning(item.id, { sprint: e.target.value || "none" }))}>
                    <option value="">— nenhum —</option>
                    {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>)}
            {optional(!!item.horizon, <div className="mpm-field">
                <span className="mpm-field__label" title="Quão perto de ser feito: now/next/later/maybe">Horizonte</span>
                <select className="mpm-inline-select" value={item.horizon || ""}
                    onChange={(e) => patch(() => api.items.update(item.id, { horizon: e.target.value }))}>
                    <option value="">—</option>
                    {HORIZONS.map((h) => <option key={h} value={h}>{horizonLabel(h)}</option>)}
                </select>
            </div>)}
            {optional(!!item.clarityState, <div className="mpm-field">
                <span className="mpm-field__label" title="Quão bem definido está: idea → refining → ready">Clareza</span>
                <select className="mpm-inline-select" value={item.clarityState || ""}
                    onChange={(e) => patch(() => api.items.update(item.id, { clarityState: e.target.value }))}>
                    <option value="">—</option>
                    {CLARITY_STATES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>)}
            {optional(!!item.effort, <div className="mpm-field">
                <span className="mpm-field__label" title="Tamanho estimado do trabalho (xs–xl)">Esforço</span>
                <select className="mpm-inline-select" value={item.effort || ""}
                    onChange={(e) => patch(() => api.items.update(item.id, { effort: e.target.value }))}>
                    <option value="">—</option>
                    {EFFORTS.map((ef) => <option key={ef} value={ef}>{ef.toUpperCase()}</option>)}
                </select>
            </div>)}
            {optional(!!item.value, <div className="mpm-field">
                <span className="mpm-field__label" title="Impacto/benefício que o item entrega">Valor</span>
                <select className="mpm-inline-select" value={item.value || ""}
                    onChange={(e) => patch(() => api.items.update(item.id, { value: e.target.value }))}>
                    <option value="">—</option>
                    {ITEM_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
            </div>)}
            {optional(!!item.area, <div className="mpm-field">
                <span className="mpm-field__label" title="Área técnica/funcional (ex.: GUI, Backend)">Área</span>
                <input className="mpm-inline-select" list="mpm-area-list" defaultValue={item.area || ""}
                    key={`area-${item.id}-${item.updatedAt || ""}`}
                    onBlur={(e) => { if (e.target.value !== (item.area || "")) patch(() => api.items.update(item.id, { area: e.target.value })) }} />
                <datalist id="mpm-area-list">
                    {AREA_SUGGESTIONS.map((a) => <option key={a} value={a} />)}
                </datalist>
            </div>)}
            {optional(!!item.ideaOrigin, <div className="mpm-field">
                <span className="mpm-field__label" title="De onde veio a ideia">Origem da ideia</span>
                <input className="mpm-inline-select" defaultValue={item.ideaOrigin || ""}
                    key={`origin-${item.id}-${item.updatedAt || ""}`}
                    onBlur={(e) => { if (e.target.value !== (item.ideaOrigin || "")) patch(() => api.items.update(item.id, { ideaOrigin: e.target.value })) }} />
            </div>)}
        </div>

        {item.blockedReason
            ? <div className="mpm-error-banner"><Icon name="ban" /> Bloqueado: {item.blockedReason}</div>
            : null}

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

        <SoftwareContextSection item={item} onSave={(input) => patch(() => api.items.update(item.id, input))} />
    </>

    const criteriaTab = <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="check circle outline" /> Critérios de aceite</div>
        {(item.acceptanceCriteria || []).length === 0
            ? <div className="mpm-tabpanel-empty">
                <Icon name="check circle outline" size="large" />
                <div>Nenhum critério de aceite.</div>
                <div style={{ fontSize: 12 }}>Defina o que precisa ser verdade para considerar este item pronto.</div>
            </div>
            : null}
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
        <input className="mpm-input" placeholder="Adicionar critério + Enter" value={critDraft}
            onChange={(e) => setCritDraft(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && critDraft.trim()) {
                    const text = critDraft.trim(); setCritDraft("")
                    patch(() => api.items.addAcceptanceCriteria(item.id, text))
                }
            }} />
    </div>

    const checklistTab = <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="tasks" /> Checklist</div>
        {(item.checklist || []).length === 0
            ? <div className="mpm-tabpanel-empty">
                <Icon name="tasks" size="large" />
                <div>Checklist vazia.</div>
                <div style={{ fontSize: 12 }}>Quebre o item em passos menores e marque conforme avança.</div>
            </div>
            : null}
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
        <input className="mpm-input" placeholder="Adicionar item + Enter" value={checkDraft}
            onChange={(e) => setCheckDraft(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && checkDraft.trim()) {
                    const text = checkDraft.trim(); setCheckDraft("")
                    patch(() => api.items.addChecklistItem(item.id, text))
                }
            }} />
    </div>

    const tabBody =
        tab === "resumo"    ? summaryTab
      : tab === "descricao" ? (editingDesc
            ? <DescriptionEditor key={`desc-${item.id}`} value={item.description || ""}
                onSave={(md) => patch(() => api.items.update(item.id, { description: md }))}
                onDone={() => setEditingDesc(false)} />
            : <div className="mpm-desc">
                <div className="mpm-desc__bar">
                    <span className="mpm-field__label" style={{ flex: 1 }}>Descrição</span>
                    <button className="mpm-btn mpm-btn--sm" title="Editar a descrição em markdown"
                        onClick={() => setEditingDesc(true)}>
                        <Icon name="pencil" /> Editar
                    </button>
                </div>
                <div className="mpm-desc__read">
                    {item.description
                        ? <Markdown>{item.description}</Markdown>
                        : <div className="mpm-tabpanel-empty">
                            <Icon name="align left" size="large" />
                            <div>Este item ainda não tem descrição.</div>
                            <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setEditingDesc(true)}>
                                <Icon name="pencil" /> Escrever descrição
                            </button>
                        </div>}
                </div>
            </div>)
      : tab === "criterios" ? criteriaTab
      : tab === "checklist" ? checklistTab
      : tab === "vinculos"  ? <LinkPanel item={item} projectId={pid} onChanged={() => patch(async () => {})} />
      : tab === "anexos"    ? <AttachmentPanel itemId={item.id} />
      : tab === "atividade" ? <div className="mpm-col mpm-gap-4">
                                <ItemNotes itemId={item.id} />
                                <CommentTimeline itemId={item.id} usersById={usersById} />
                              </div>
      : <AuditTimeline projectId={pid} entityId={item.id} />

    return <aside className="mpm-inspector">
        {/* Header sticky: key, tipo, título editável e ações */}
        <div className="mpm-inspector__head">
            <span className="mpm-mono mpm-muted">{item.key}</span>
            <TypeBadge type={item.type} />
            <StatusChip status={item.statusKey} />
            <span style={{ flex: 1 }} />
            <span className="mpm-iconbtn" title="Excluir item" onClick={() => setConfirmDelete(true)}><Icon name="trash" /></span>
            <span className="mpm-iconbtn" title="Fechar" onClick={onClose}><Icon name="close" /></span>
        </div>

        <div className="mpm-inspector__titlebar">
            <input
                className="mpm-input"
                style={{ fontSize: "var(--mp-text-lg)", fontWeight: 700 }}
                defaultValue={item.title}
                key={`title-${item.id}-${item.updatedAt || ""}`}
                onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== item.title) patch(() => api.items.update(item.id, { title: v }))
                }} />
        </div>

        {/* Tabs sticky */}
        <div className="mpm-tabs" role="tablist">
            {TABS.map((t) =>
                <button key={t.key} role="tab" title={t.hint}
                    className={`mpm-tab ${tab === t.key ? "is-active" : ""}`}
                    onClick={() => setTab(t.key)}>
                    <Icon name={t.icon} /> <span>{t.label}</span>
                </button>)}
        </div>

        <div className="mpm-inspector__body">
            <ErrorBanner error={error} />
            {tabBody}
        </div>

        {confirmDelete
            ? <ConfirmActionModal
                title="Excluir item"
                danger
                message={<>Excluir <strong>{item.key}</strong> — {item.title}?</>}
                consequences={[
                    <>Soft delete: o item some das listagens (reversível por um administrador).</>,
                    item.children && item.children.length > 0
                        ? <>{item.children.length} subtarefa(s) ficam órfãs.</>
                        : <>Comentários e anexos deixam de ser acessíveis pelo item.</>
                ]}
                confirmLabel="Excluir item"
                busy={deleting}
                error={error}
                onConfirm={doDelete}
                onCancel={() => setConfirmDelete(false)} />
            : null}
    </aside>
}

export default WorkItemInspector
