import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { useReadOnly } from "../Hooks/useReadOnly"
import { Project, RiskItem, User, Milestone, RISK_LEVELS, RISK_STATUSES } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import { Modal, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { riskScaleLabel, riskStatusLabel, riskLevelLabel } from "../Utils/labels"
import { feedbackTarget } from "../Utils/feedbackTarget"

// Nível derivado da matriz 3×3 (mesma regra do RisksStore, para colorir células).
const WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3 }
const cellLevel = (probability: string, impact: string): string => {
    const score = (WEIGHT[probability] || 0) * (WEIGHT[impact] || 0)
    if (score <= 2) return "low"
    if (score <= 4) return "moderate"
    if (score <= 6) return "high"
    return "critical"
}

// Cor de cada nível (fundo/texto). Amarelo/moderado usa texto escuro (contraste).
const LEVEL_COLOR: Record<string, { bg: string; fg: string }> = {
    low:      { bg: "#16a34a", fg: "#ffffff" },
    moderate: { bg: "#eab308", fg: "#1f1300" },
    high:     { bg: "#f97316", fg: "#ffffff" },
    critical: { bg: "#dc2626", fg: "#ffffff" }
}
const levelStyle = (level?: string | null): React.CSSProperties => {
    const c = LEVEL_COLOR[level || ""] || { bg: "var(--mp-surface-2, #e5e5e5)", fg: "inherit" }
    return { background: c.bg, color: c.fg }
}
const LevelBadge = ({ level }: { level?: string | null }) =>
    <span className="mpm-chip" style={{ ...levelStyle(level), fontWeight: 600 }}>{riskLevelLabel(level) || "—"}</span>

const RisksPage = () => {
    const api = useApi()
    const readOnly = useReadOnly()
    const { projectId } = useParams<{ projectId: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [risks, setRisks] = useState<RiskItem[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<RiskItem | null>(null)
    const [deleting, setDeleting] = useState(false)

    const selected = useMemo(() => risks.find((r) => r.id === selectedId) || null, [risks, selectedId])

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.risks.list(projectId)
            .then((l) => setRisks(l || []))
            .catch((e) => setError(e.message))
    }, [api, projectId])

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
        api.planning.listMilestones(projectId).then((l) => setMilestones(l || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api, load])

    // Riscos mexidos por agentes aparecem sem refresh.
    useLiveReload(load, { projectId })

    const patch = async (fn: () => Promise<any>) => {
        setError(null)
        try { await fn(); await load() } catch (e: any) { setError(e.message) }
    }

    const doDelete = async () => {
        if (!confirmDelete) return
        setDeleting(true); setError(null)
        try {
            await api.risks.remove(confirmDelete.id)
            if (selectedId === confirmDelete.id) setSelectedId(null)
            setConfirmDelete(null); setDeleting(false)
            await load()
        } catch (e: any) { setError(e.message); setDeleting(false); setConfirmDelete(null) }
    }

    // Contagem de riscos por célula (probabilidade × impacto) para o heatmap.
    const countAt = (probability: string, impact: string) =>
        risks.filter((r) => r.probability === probability && r.impact === impact).length

    // Matriz: linhas = impacto (alto no topo), colunas = probabilidade (baixo→alto).
    const IMPACTS = [...RISK_LEVELS].reverse()   // high, medium, low
    const ownerName = (id?: string | null) => (id ? (users.find((u) => u.id === id)?.displayName || "—") : "—")
    const milestoneName = (id?: string | null) => (id ? (milestones.find((m) => m.id === id)?.name || "—") : "—")

    const inspector = selected
        ? <RiskInspector risk={selected} users={users} milestones={milestones} readOnly={readOnly}
            onPatch={(input) => patch(() => api.risks.update(selected.id, input))}
            onDelete={() => setConfirmDelete(selected)}
            onClose={() => setSelectedId(null)} projectId={projectId} />
        : undefined

    return <AppShell active="risks" activeProjectId={projectId}
        activeProjectName={project ? project.name : undefined}
        breadcrumb={[
            { label: "Projetos", to: "/" },
            { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
            { label: "Riscos" }
        ]}
        title={project ? project.name : "Projeto"}
        subtitle="Registro de riscos · matriz probabilidade × impacto"
        actions={readOnly ? undefined : <>
            <PageFeedbackButton scope="project" projectId={projectId} label="Riscos" compact />
            <button className="mpm-btn mpm-btn--primary mpm-btn--sm" onClick={() => setCreating(true)}>
                <Icon name="plus" /> Novo risco
            </button>
        </>}
        inspector={inspector} onInspectorClose={() => setSelectedId(null)}>

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : <div className="mpm-col" style={{ gap: "var(--mp-space-5)", padding: "var(--mp-space-4)" }}>

                {/* Matriz de risco (heatmap 3×3) */}
                <section {...feedbackTarget({ entityType: "project", entityId: projectId, project: projectId, field: "risk-matrix", fieldLabel: "Matriz de risco" })}>
                    <div className="mpm-section-title"><Icon name="th" /> Matriz de risco</div>
                    <div style={{ overflowX: "auto" }}>
                        <table className="mpm-risk-matrix" style={{ borderCollapse: "collapse" }}>
                            <tbody>
                                {IMPACTS.map((impact) =>
                                    <tr key={impact}>
                                        <th style={{ padding: "6px 10px", textAlign: "right", fontSize: 12, whiteSpace: "nowrap" }}>
                                            {impact === IMPACTS[0] ? <span className="mpm-muted" style={{ marginRight: 8 }}>impacto ↑</span> : null}
                                            {riskScaleLabel(impact)}
                                        </th>
                                        {RISK_LEVELS.map((prob) => {
                                            const lvl = cellLevel(prob, impact)
                                            const n = countAt(prob, impact)
                                            return <td key={prob} title={`Probabilidade ${riskScaleLabel(prob)} × impacto ${riskScaleLabel(impact)} — ${riskLevelLabel(lvl)}`}
                                                style={{ ...levelStyle(lvl), width: 84, height: 56, textAlign: "center", border: "2px solid var(--mp-bg, #fff)", fontWeight: 700, fontSize: 18, opacity: n === 0 ? 0.35 : 1 }}>
                                                {n > 0 ? n : ""}
                                            </td>
                                        })}
                                    </tr>)}
                                <tr>
                                    <th />
                                    {RISK_LEVELS.map((prob) =>
                                        <td key={prob} style={{ textAlign: "center", fontSize: 12, padding: "4px 0" }}>{riskScaleLabel(prob)}</td>)}
                                </tr>
                                <tr>
                                    <th />
                                    <td colSpan={RISK_LEVELS.length} style={{ textAlign: "center" }}>
                                        <span className="mpm-muted" style={{ fontSize: 12 }}>probabilidade →</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Lista de riscos */}
                <section>
                    <div className="mpm-section-title"><Icon name="list" /> Riscos ({risks.length})</div>
                    {risks.length === 0
                        ? <EmptyState icon="warning sign" title="Nenhum risco registrado"
                            hint={readOnly ? undefined : "Use “Novo risco” para começar o registro de riscos do projeto."} />
                        : <div style={{ overflowX: "auto" }}>
                            <table className="mpm-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ textAlign: "left", fontSize: 12 }} className="mpm-muted">
                                        <th style={{ padding: "6px 8px" }}>Risco</th>
                                        <th style={{ padding: "6px 8px" }}>Nível</th>
                                        <th style={{ padding: "6px 8px" }}>P × I</th>
                                        <th style={{ padding: "6px 8px" }}>Estado</th>
                                        <th style={{ padding: "6px 8px" }}>Dono</th>
                                        <th style={{ padding: "6px 8px" }}>Marco</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {risks.map((r) =>
                                        <tr key={r.id} onClick={() => setSelectedId(r.id)}
                                            className={`mpm-table__row ${selectedId === r.id ? "is-active" : ""}`}
                                            style={{ cursor: "pointer", borderTop: "1px solid var(--mp-border, #e5e5e5)" }}>
                                            <td style={{ padding: "8px" }}>
                                                <strong>{r.title}</strong>
                                                {r.category ? <span className="mpm-chip mpm-chip--info" style={{ marginLeft: 8 }}>{r.category}</span> : null}
                                            </td>
                                            <td style={{ padding: "8px" }}><LevelBadge level={r.level} /></td>
                                            <td style={{ padding: "8px", fontSize: 12, whiteSpace: "nowrap" }}>{riskScaleLabel(r.probability)} × {riskScaleLabel(r.impact)}</td>
                                            <td style={{ padding: "8px" }}><span className="mpm-chip">{riskStatusLabel(r.status)}</span></td>
                                            <td style={{ padding: "8px", fontSize: 12 }}>{ownerName(r.ownerUserId)}</td>
                                            <td style={{ padding: "8px", fontSize: 12 }}>{milestoneName(r.milestoneId)}</td>
                                        </tr>)}
                                </tbody>
                            </table>
                        </div>}
                </section>
            </div>}

        {creating
            ? <RiskCreateModal projectId={projectId!} onClose={() => setCreating(false)}
                onCreate={async (input) => { await api.risks.create(projectId!, input); setCreating(false); await load() }} />
            : null}

        {confirmDelete
            ? <ConfirmActionModal
                title="Remover risco"
                message={`Remover o risco “${confirmDelete.title}”? Esta ação pode ser desfeita restaurando o projeto, mas o risco sai do registro.`}
                confirmLabel="Remover" danger busy={deleting}
                onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
            : null}
    </AppShell>
}

// ── Inspector lateral: edição de um risco (auto-save) ────────────────────────
interface RiskInspectorProps {
    risk: RiskItem
    users: User[]
    milestones: Milestone[]
    readOnly: boolean
    projectId?: string
    onPatch: (input: any) => void
    onDelete: () => void
    onClose: () => void
}
const RiskInspector = ({ risk, users, milestones, readOnly, projectId, onPatch, onDelete, onClose }: RiskInspectorProps) => {
    const k = (field: string) => `${field}-${risk.id}-${risk.updatedAt || ""}`
    return <aside className="mpm-inspector">
        <div className="mpm-inspector__head">
            <LevelBadge level={risk.level} />
            <strong style={{ flex: 1, marginLeft: 8 }}>Risco</strong>
            <span className="mpm-iconbtn" onClick={onClose}><Icon name="close" /></span>
        </div>
        <div className="mpm-inspector__body">
            <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                {...feedbackTarget({ entityType: "risk", entityId: risk.id, project: projectId, fieldLabel: "Campos do risco" })}>
                <div className="mpm-field">
                    <span className="mpm-field__label">Título</span>
                    <input className="mpm-input" defaultValue={risk.title} key={k("title")}
                        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== risk.title) onPatch({ title: e.target.value.trim() }) }} />
                </div>
                <div className="mpm-row mpm-gap-4">
                    <div className="mpm-field" style={{ flex: 1 }}>
                        <span className="mpm-field__label">Probabilidade</span>
                        <select className="mpm-select" value={risk.probability}
                            onChange={(e) => onPatch({ probability: e.target.value })}>
                            {RISK_LEVELS.map((v) => <option key={v} value={v}>{riskScaleLabel(v)}</option>)}
                        </select>
                    </div>
                    <div className="mpm-field" style={{ flex: 1 }}>
                        <span className="mpm-field__label">Impacto</span>
                        <select className="mpm-select" value={risk.impact}
                            onChange={(e) => onPatch({ impact: e.target.value })}>
                            {RISK_LEVELS.map((v) => <option key={v} value={v}>{riskScaleLabel(v)}</option>)}
                        </select>
                    </div>
                </div>
                <div className="mpm-row mpm-gap-4">
                    <div className="mpm-field" style={{ flex: 1 }}>
                        <span className="mpm-field__label">Estado</span>
                        <select className="mpm-select" value={risk.status}
                            onChange={(e) => onPatch({ status: e.target.value })}>
                            {RISK_STATUSES.map((v) => <option key={v} value={v}>{riskStatusLabel(v)}</option>)}
                        </select>
                    </div>
                    <div className="mpm-field" style={{ flex: 1 }}>
                        <span className="mpm-field__label">Categoria</span>
                        <input className="mpm-input" defaultValue={risk.category || ""} key={k("cat")}
                            onBlur={(e) => { if (e.target.value !== (risk.category || "")) onPatch({ category: e.target.value }) }} />
                    </div>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Dono</span>
                    <select className="mpm-select" value={risk.ownerUserId || ""}
                        onChange={(e) => onPatch({ ownerUserId: e.target.value || "none" })}>
                        <option value="">— não atribuído —</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Marco afetado</span>
                    <select className="mpm-select" value={risk.milestoneId || ""}
                        onChange={(e) => onPatch({ milestoneId: e.target.value || "none" })}>
                        <option value="">— nenhum —</option>
                        {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Descrição</span>
                    <textarea className="mpm-textarea" defaultValue={risk.description || ""} key={k("desc")} rows={4}
                        onBlur={(e) => { if (e.target.value !== (risk.description || "")) onPatch({ description: e.target.value }) }} />
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Plano de mitigação</span>
                    <textarea className="mpm-textarea" defaultValue={risk.mitigation || ""} key={k("mit")} rows={3}
                        onBlur={(e) => { if (e.target.value !== (risk.mitigation || "")) onPatch({ mitigation: e.target.value }) }} />
                </div>
                <div className="mpm-field">
                    <span className="mpm-field__label">Plano de contingência</span>
                    <textarea className="mpm-textarea" defaultValue={risk.contingency || ""} key={k("cont")} rows={3}
                        onBlur={(e) => { if (e.target.value !== (risk.contingency || "")) onPatch({ contingency: e.target.value }) }} />
                </div>
                {!readOnly
                    ? <button className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ marginTop: "var(--mp-space-3)", color: "#dc2626" }} onClick={onDelete}>
                        <Icon name="trash" /> Remover risco
                    </button>
                    : null}
            </fieldset>
        </div>
    </aside>
}

// ── Modal de criação ─────────────────────────────────────────────────────────
const RiskCreateModal = ({ projectId, onClose, onCreate }: { projectId: string; onClose: () => void; onCreate: (input: any) => Promise<void> }) => {
    const [title, setTitle] = useState("")
    const [probability, setProbability] = useState("medium")
    const [impact, setImpact] = useState("medium")
    const [description, setDescription] = useState("")
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const submit = async () => {
        if (!title.trim()) return
        setBusy(true); setErr(null)
        try { await onCreate({ title: title.trim(), probability, impact, description: description.trim() || undefined }) }
        catch (e: any) { setErr(e.message); setBusy(false) }
    }

    return <Modal title="Novo risco" icon="warning sign" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !title.trim()}>Registrar</button>
        </>}>
        <ErrorBanner error={err} />
        <div className="mpm-field"><span className="mpm-field__label">Título</span>
            <input className="mpm-input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="mpm-row mpm-gap-4">
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Probabilidade</span>
                <select className="mpm-select" value={probability} onChange={(e) => setProbability(e.target.value)}>
                    {RISK_LEVELS.map((v) => <option key={v} value={v}>{riskScaleLabel(v)}</option>)}
                </select></div>
            <div className="mpm-field" style={{ flex: 1 }}><span className="mpm-field__label">Impacto</span>
                <select className="mpm-select" value={impact} onChange={(e) => setImpact(e.target.value)}>
                    {RISK_LEVELS.map((v) => <option key={v} value={v}>{riskScaleLabel(v)}</option>)}
                </select></div>
        </div>
        <div className="mpm-field"><span className="mpm-field__label">Descrição</span>
            <textarea className="mpm-textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
    </Modal>
}

export default RisksPage
