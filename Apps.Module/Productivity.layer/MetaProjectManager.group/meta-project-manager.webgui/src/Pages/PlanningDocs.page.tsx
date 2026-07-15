import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { useReadOnly } from "../Hooks/useReadOnly"
import { Project, PlanningDoc, Milestone, PLANNING_DOC_STATUSES, PLANNING_DOC_SECTIONS } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import Markdown from "../Components/Markdown"
import { Modal, Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { planningDocStatusLabel } from "../Utils/labels"
import { feedbackTarget } from "../Utils/feedbackTarget"

const PlanningDocsPage = () => {
    const api = useApi()
    const readOnly = useReadOnly()
    const navigate = useNavigate()
    const { projectId, planningDocId } = useParams<{ projectId: string; planningDocId?: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [docs, setDocs] = useState<PlanningDoc[]>([])
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)
    const [creating, setCreating] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<PlanningDoc | null>(null)
    const [deleting, setDeleting] = useState(false)

    const selected = useMemo(() => docs.find((d) => d.id === planningDocId) || null, [docs, planningDocId])

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.planningDocs.list(projectId)
            .then((l) => setDocs(l || []))
            .catch((e) => setError(e.message))
    }, [api, projectId])

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.planning.listMilestones(projectId).then((l) => setMilestones(l || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api, load])

    useLiveReload(load, { projectId })
    useEffect(() => { setEditing(false) }, [planningDocId])

    const select = (id: string) => navigate(`/projects/${projectId}/planning-docs/${id}`)

    const patch = async (input: any) => {
        if (!selected) return
        setError(null)
        try { await api.planningDocs.update(selected.id, input); await load() }
        catch (e: any) { setError(e.message) }
    }

    const doDelete = async () => {
        if (!confirmDelete) return
        setDeleting(true); setError(null)
        try {
            await api.planningDocs.remove(confirmDelete.id)
            const wasSelected = selected && selected.id === confirmDelete.id
            setConfirmDelete(null); setDeleting(false)
            await load()
            if (wasSelected) navigate(`/projects/${projectId}/planning-docs`)
        } catch (e: any) { setError(e.message); setDeleting(false); setConfirmDelete(null) }
    }

    const milestoneName = (id?: string | null) => (id ? (milestones.find((m) => m.id === id)?.name || "—") : null)

    return <AppShell active="planning-docs" activeProjectId={projectId}
        activeProjectName={project ? project.name : undefined}
        breadcrumb={[
            { label: "Projetos", to: "/" },
            { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
            { label: "Planos" }
        ]}
        title={project ? project.name : "Projeto"}
        subtitle="Documentos de planejamento · termo de abertura e escopo"
        actions={readOnly ? undefined : <PageFeedbackButton scope="project" projectId={projectId} label="Planos" compact />}>

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : <div className="mpm-wiki">
                {/* Lista de documentos */}
                <aside className="mpm-wiki__tree">
                    <div className="mpm-wiki__tree-head">
                        <Icon name="file alternate outline" /> <strong style={{ flex: 1 }}>Documentos</strong>
                        {!readOnly
                            ? <button className="mpm-btn mpm-btn--sm mpm-btn--primary" title="Novo documento de planejamento" onClick={() => setCreating(true)}>
                                <Icon name="plus" /> Novo
                            </button>
                            : null}
                    </div>
                    {docs.length === 0
                        ? <div className="mpm-muted" style={{ padding: "var(--mp-space-3)", fontSize: 12 }}>
                            Nenhum documento ainda.{readOnly ? "" : " Crie o primeiro acima."}
                        </div>
                        : docs.map((d) =>
                            <a key={d.id} className={`mpm-nav__item ${selected && selected.id === d.id ? "is-active" : ""}`}
                                onClick={() => select(d.id)} style={{ cursor: "pointer" }}>
                                <Icon name="file alternate outline" />
                                <span style={{ flex: 1 }}>{d.title}</span>
                                <span className="mpm-chip" style={{ fontSize: 11 }}>{planningDocStatusLabel(d.status)}</span>
                            </a>)}
                </aside>

                {/* Documento selecionado */}
                <div className="mpm-wiki__content">
                    {!selected
                        ? <EmptyState icon="file alternate outline" title="Selecione um documento"
                            hint={docs.length === 0 && !readOnly ? "Ou crie o primeiro com “Novo”." : "Escolha um documento na lista à esquerda."} />
                        : <div className="mpm-col" style={{ gap: "var(--mp-space-4)", padding: "var(--mp-space-4)", maxWidth: 900 }}
                            {...feedbackTarget({ entityType: "planning-doc", entityId: selected.id, project: projectId, fieldLabel: "Documento de planejamento" })}>

                            {/* Cabeçalho: título, status, versão, marco, ações */}
                            <div className="mpm-row" style={{ alignItems: "center", gap: "var(--mp-space-3)", flexWrap: "wrap" }}>
                                {editing
                                    ? <input className="mpm-input" defaultValue={selected.title} key={`t-${selected.id}-${selected.version}`}
                                        style={{ fontSize: 20, fontWeight: 700, flex: 1, minWidth: 240 }}
                                        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== selected.title) patch({ title: e.target.value.trim() }) }} />
                                    : <h2 style={{ flex: 1, margin: 0, minWidth: 240 }}>{selected.title}</h2>}
                                <span className="mpm-chip mpm-chip--info" title="Versão do documento (incrementa a cada edição)">v{selected.version}</span>
                                {editing
                                    ? <select className="mpm-select" value={selected.status} style={{ width: "auto" }}
                                        onChange={(e) => patch({ status: e.target.value })}>
                                        {PLANNING_DOC_STATUSES.map((s) => <option key={s} value={s}>{planningDocStatusLabel(s)}</option>)}
                                    </select>
                                    : <span className="mpm-chip">{planningDocStatusLabel(selected.status)}</span>}
                                {!readOnly
                                    ? <button className={`mpm-btn mpm-btn--sm ${editing ? "mpm-btn--primary" : "mpm-btn--ghost"}`} onClick={() => setEditing(!editing)}>
                                        <Icon name={editing ? "check" : "edit"} /> {editing ? "Concluir" : "Editar"}
                                    </button>
                                    : null}
                                {!readOnly
                                    ? <button className="mpm-btn mpm-btn--sm mpm-btn--ghost" title="Remover documento" onClick={() => setConfirmDelete(selected)}>
                                        <Icon name="trash" />
                                    </button>
                                    : null}
                            </div>

                            {/* Marco vinculado */}
                            <div className="mpm-field" style={{ maxWidth: 360 }}>
                                <span className="mpm-field__label">Marco vinculado</span>
                                {editing
                                    ? <select className="mpm-select" value={selected.milestoneId || ""}
                                        onChange={(e) => patch({ milestoneId: e.target.value || "none" })}>
                                        <option value="">— nenhum —</option>
                                        {milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    : <span className="mpm-muted">{milestoneName(selected.milestoneId) || "— nenhum —"}</span>}
                            </div>

                            {/* Seções estruturadas */}
                            {PLANNING_DOC_SECTIONS.map((sec) => {
                                const value = (selected as any)[sec.key] as string | undefined
                                return <section key={sec.key}
                                    {...feedbackTarget({ entityType: "planning-doc", entityId: selected.id, project: projectId, field: sec.key, fieldLabel: sec.label })}>
                                    <div className="mpm-section-title">{sec.label}</div>
                                    {editing
                                        ? <textarea className="mpm-textarea" defaultValue={value || ""} rows={4}
                                            key={`${sec.key}-${selected.id}-${selected.version}`}
                                            placeholder={`${sec.label} (markdown)`}
                                            onBlur={(e) => { if (e.target.value !== (value || "")) patch({ [sec.key]: e.target.value }) }} />
                                        : (value && value.trim()
                                            ? <Markdown>{value}</Markdown>
                                            : <div className="mpm-muted" style={{ fontSize: 13 }}>—</div>)}
                                </section>
                            })}
                        </div>}
                </div>
            </div>}

        {creating
            ? <PlanningDocCreateModal onClose={() => setCreating(false)}
                onCreate={async (title) => {
                    const created = await api.planningDocs.create(projectId!, { title })
                    setCreating(false); await load(); select(created.id)
                }} />
            : null}

        {confirmDelete
            ? <ConfirmActionModal
                title="Remover documento"
                message={`Remover o documento “${confirmDelete.title}”? Ele sai da lista de planejamento.`}
                confirmLabel="Remover" danger busy={deleting}
                onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
            : null}
    </AppShell>
}

const PlanningDocCreateModal = ({ onClose, onCreate }: { onClose: () => void; onCreate: (title: string) => Promise<void> }) => {
    const [title, setTitle] = useState("")
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const submit = async () => {
        if (!title.trim()) return
        setBusy(true); setErr(null)
        try { await onCreate(title.trim()) } catch (e: any) { setErr(e.message); setBusy(false) }
    }
    return <Modal title="Novo documento de planejamento" icon="file alternate outline" onClose={onClose}
        footer={<>
            <button className="mpm-btn mpm-btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="mpm-btn mpm-btn--primary" onClick={submit} disabled={busy || !title.trim()}>Criar</button>
        </>}>
        <ErrorBanner error={err} />
        <div className="mpm-field"><span className="mpm-field__label">Título</span>
            <input className="mpm-input" autoFocus value={title} placeholder="Ex.: Termo de Abertura"
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit() }} /></div>
        <div className="mpm-muted" style={{ fontSize: 12 }}>
            As seções (objetivo, escopo, premissas…) são preenchidas depois, no modo de edição.
        </div>
    </Modal>
}

export default PlanningDocsPage
