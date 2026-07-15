import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import useLiveReload from "../Hooks/useLiveReload"
import { useReadOnly } from "../Hooks/useReadOnly"
import { ItemNavigatorProvider } from "../Hooks/useItemNavigator"
import { Project, DocPage, User } from "../api/types"
import AppShell from "../Components/AppShell"
import PageFeedbackButton from "../Components/PageFeedbackButton"
import WorkItemInspector from "../Components/WorkItemInspector"
import Markdown from "../Components/Markdown"
import DescriptionEditor from "../Components/DescriptionEditor"
import DocAttachmentPanel from "../Components/DocAttachmentPanel"
import ConfirmActionModal from "../Components/ConfirmActionModal"
import { Loading, EmptyState, ErrorBanner } from "../Components/Primitives"
import { feedbackTarget } from "../Utils/feedbackTarget"
import { triggerTextDownload, triggerBase64Download, printHtmlDocument } from "../Utils/triggerDownload"

// Ordena os filhos de um nó (por order, depois criação — estável).
const childrenOf = (pages: DocPage[], parentId: string | null): DocPage[] =>
    pages.filter((p) => (p.parentId || null) === parentId)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

// Cadeia raiz→página (para a trilha no cabeçalho do conteúdo).
const ancestryOf = (pages: DocPage[], id?: string | null): DocPage[] => {
    const byId: Record<string, DocPage> = {}
    pages.forEach((p) => { byId[p.id] = p })
    const chain: DocPage[] = []
    let cur = id ? byId[id] : undefined
    let guard = 0
    while (cur && guard < 50) { chain.unshift(cur); cur = cur.parentId ? byId[cur.parentId] : undefined; guard++ }
    return chain
}

// DocsPage: wiki do projeto. Árvore de páginas à esquerda; conteúdo markdown à
// direita (leitura + editor rico). Referências [[MP-1]] abrem o item. Em projeto
// arquivado, tudo em somente-leitura (afordâncias escondidas por useReadOnly).
const DocsPage = () => {
    const api = useApi()
    const readOnly = useReadOnly()
    const navigate = useNavigate()
    const { projectId, docPageId } = useParams<{ projectId: string; docPageId?: string }>()

    const [project, setProject] = useState<Project | null>(null)
    const [pages, setPages] = useState<DocPage[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
    const [editing, setEditing] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<DocPage | null>(null)
    const [deleting, setDeleting] = useState(false)
    // Item aberto a partir de uma referência [[MP-1]] no corpo do doc.
    const [selectedItem, setSelectedItem] = useState<string | null>(null)
    // Drag & drop da árvore (reparentar).
    const [dragId, setDragId] = useState<string | null>(null)
    // Exportação da documentação inteira (menu + estado de "gerando").
    const [exportOpen, setExportOpen] = useState(false)
    const [exportBusy, setExportBusy] = useState<null | "html" | "pdf" | "zip">(null)

    const selected = useMemo(() => pages.find((p) => p.id === docPageId) || null, [pages, docPageId])

    const load = useCallback(() => {
        if (!projectId) return Promise.resolve()
        return api.docs.list(projectId)
            .then((l) => setPages(l || []))
            .catch((e) => setError(e.message))
    }, [api, projectId])

    useEffect(() => {
        if (!projectId) return
        setLoading(true); setError(null)
        api.projects.get(projectId).then(setProject).catch((e) => setError(e.message))
        api.users.list({}).then((l) => setUsers(l || [])).catch(() => {})
        load().then(() => setLoading(false))
    }, [projectId, api, load])

    // Docs mexidas por agentes aparecem sem refresh.
    useLiveReload(load, { projectId })

    // Sai do modo edição ao trocar de página.
    useEffect(() => { setEditing(false) }, [docPageId])

    const select = (id: string) => navigate(`/projects/${projectId}/docs/${id}`)

    const create = async (parentId: string | null) => {
        setError(null)
        try {
            const page = await api.docs.create(projectId!, { parentId: parentId || undefined, title: "Nova página" })
            if (parentId) setCollapsed((c) => ({ ...c, [parentId]: false }))
            await load()
            navigate(`/projects/${projectId}/docs/${page.id}`)
            setEditing(true)
        } catch (e: any) { setError(e.message) }
    }

    const saveTitle = async (page: DocPage, title: string) => {
        const t = title.trim()
        if (!t || t === page.title) return
        try { await api.docs.update(page.id, { title: t }); await load() } catch (e: any) { setError(e.message) }
    }

    const saveBody = async (page: DocPage, body: string) => {
        try { const upd = await api.docs.update(page.id, { body }); setPages((prev) => prev.map((p) => p.id === upd.id ? upd : p)) }
        catch (e: any) { setError(e.message) }
    }

    const doDelete = async () => {
        if (!confirmDelete) return
        setDeleting(true); setError(null)
        try {
            await api.docs.remove(confirmDelete.id)
            const wasSelected = selected && selected.id === confirmDelete.id
            setConfirmDelete(null); setDeleting(false)
            await load()
            if (wasSelected) navigate(`/projects/${projectId}/docs`)
        } catch (e: any) { setError(e.message); setDeleting(false); setConfirmDelete(null) }
    }

    // Reparentar via drag & drop. Soltar sobre uma página torna a arrastada filha
    // dela; soltar na zona-raiz a promove a raiz. O ciclo é barrado no backend.
    const movePage = async (id: string, parentId: string | null) => {
        setDragId(null)
        const page = pages.find((p) => p.id === id)
        if (!page || (page.parentId || null) === parentId || page.id === parentId) return
        try { await api.docs.move(id, { parentId: parentId === null ? "none" : parentId }); await load() }
        catch (e: any) { setError(e.message) }
    }

    // Reordena entre irmãos (troca a ordem com o vizinho).
    const reorder = async (page: DocPage, dir: "up" | "down") => {
        const siblings = childrenOf(pages, page.parentId || null)
        const idx = siblings.findIndex((s) => s.id === page.id)
        const j = dir === "up" ? idx - 1 : idx + 1
        if (j < 0 || j >= siblings.length) return
        const other = siblings[j]
        setError(null)
        try {
            await api.docs.move(page.id, { order: other.order })
            await api.docs.move(other.id, { order: page.order })
            await load()
        } catch (e: any) { setError(e.message) }
    }

    // ── Exportação da documentação inteira ──
    // HTML autocontido e ZIP são gerados no backend (funciona por HTTP e IPC); o
    // PDF reaproveita o HTML e chama a impressão do sistema ("Salvar como PDF").
    const exportHtml = async () => {
        if (!projectId) return
        setExportOpen(false); setExportBusy("html"); setError(null)
        try { const r = await api.docs.exportHtml(projectId); triggerTextDownload(r.filename, r.mimeType || "text/html", r.html) }
        catch (e: any) { setError(e.message) } finally { setExportBusy(null) }
    }
    const exportPdf = async () => {
        if (!projectId) return
        setExportOpen(false); setExportBusy("pdf"); setError(null)
        try { const r = await api.docs.exportHtml(projectId); printHtmlDocument(r.html) }
        catch (e: any) { setError(e.message) } finally { setExportBusy(null) }
    }
    const exportZip = async () => {
        if (!projectId) return
        setExportOpen(false); setExportBusy("zip"); setError(null)
        try { const r = await api.docs.exportArchive(projectId); triggerBase64Download(r.filename, r.mimeType || "application/zip", r.base64) }
        catch (e: any) { setError(e.message) } finally { setExportBusy(null) }
    }

    // Nó da árvore (recursivo).
    const renderNode = (page: DocPage, depth: number): React.ReactNode => {
        const kids = childrenOf(pages, page.id)
        const isOpen = !collapsed[page.id]
        const isActive = selected && selected.id === page.id
        return <div key={page.id}>
            <div className={`mpm-doctree__row ${isActive ? "is-active" : ""} ${dragId === page.id ? "is-dragging" : ""}`}
                style={{ paddingLeft: 6 + depth * 14 }}
                draggable={!readOnly}
                onDragStart={readOnly ? undefined : (e) => { e.stopPropagation(); setDragId(page.id) }}
                onDragEnd={readOnly ? undefined : () => setDragId(null)}
                onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                onDrop={readOnly ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); if (dragId) movePage(dragId, page.id) }}
                onClick={() => select(page.id)}>
                {kids.length > 0
                    ? <span className="mpm-doctree__caret" onClick={(e) => { e.stopPropagation(); setCollapsed((c) => ({ ...c, [page.id]: !isOpen })) }}>
                        <Icon name={isOpen ? "caret down" : "caret right"} />
                    </span>
                    : <span className="mpm-doctree__caret mpm-doctree__caret--leaf">{page.icon || "•"}</span>}
                <span className="mpm-doctree__title" title={page.title}>{page.icon && kids.length > 0 ? `${page.icon} ` : ""}{page.title}</span>
                {!readOnly
                    ? <span className="mpm-doctree__actions">
                        <span className="mpm-iconbtn mpm-btn--sm" data-tip="Nova sub-página" onClick={(e) => { e.stopPropagation(); create(page.id) }}><Icon name="plus" /></span>
                        <span className="mpm-iconbtn mpm-btn--sm" data-tip="Excluir página (e sub-páginas)" onClick={(e) => { e.stopPropagation(); setConfirmDelete(page) }}><Icon name="trash" /></span>
                    </span>
                    : null}
            </div>
            {kids.length > 0 && isOpen ? kids.map((k) => renderNode(k, depth + 1)) : null}
        </div>
    }

    const roots = childrenOf(pages, null)
    const ancestry = ancestryOf(pages, selected ? selected.id : undefined)
    const siblings = selected ? childrenOf(pages, selected.parentId || null) : []
    const selIdx = selected ? siblings.findIndex((s) => s.id === selected.id) : -1

    const inspector = selectedItem
        ? <WorkItemInspector itemId={selectedItem} projectId={projectId} users={users} onClose={() => setSelectedItem(null)} />
        : undefined

    return <ItemNavigatorProvider onOpenItem={setSelectedItem}>
        <AppShell active="docs" activeProjectId={projectId}
            activeProjectName={project ? project.name : undefined}
            breadcrumb={[
                { label: "Projetos", to: "/" },
                { label: project ? project.name : "Projeto", to: projectId ? `/projects/${projectId}` : undefined },
                { label: "Documentação" }
            ]}
            title={project ? project.name : "Projeto"}
            subtitle="Documentação · wiki do projeto em árvore"
            actions={<div className="mpm-row" style={{ gap: "var(--mp-space-2)", alignItems: "center" }}>
                {/* Exportar a documentação inteira (disponível também em projeto arquivado). */}
                <div className="mpm-export" style={{ position: "relative" }}>
                    <button className="mpm-btn" disabled={!!exportBusy}
                        title="Exportar a documentação inteira" onClick={() => setExportOpen((o) => !o)}>
                        {exportBusy ? <Icon name="spinner" loading /> : <Icon name="download" />}
                        <span>Exportar</span> <Icon name="caret down" style={{ margin: 0 }} />
                    </button>
                    {exportOpen
                        ? <>
                            <div className="mpm-export__backdrop" onClick={() => setExportOpen(false)} />
                            <div className="mpm-ctxmenu mpm-export__menu">
                                <button className="mpm-ctxmenu__item" onClick={exportHtml}>
                                    <Icon name="file code outline" /> HTML <span className="mpm-muted">&nbsp;· arquivo único</span>
                                </button>
                                <button className="mpm-ctxmenu__item" onClick={exportPdf}>
                                    <Icon name="file pdf outline" /> PDF <span className="mpm-muted">&nbsp;· via impressão</span>
                                </button>
                                <button className="mpm-ctxmenu__item" onClick={exportZip}>
                                    <Icon name="file archive outline" /> ZIP <span className="mpm-muted">&nbsp;· markdown + anexos</span>
                                </button>
                            </div>
                        </>
                        : null}
                </div>
                {!readOnly ? <PageFeedbackButton scope="project" projectId={projectId} label="Documentação" compact /> : null}
            </div>}
            inspector={inspector} onInspectorClose={() => setSelectedItem(null)}>

        <ErrorBanner error={error} />

        {loading
            ? <Loading />
            : <div className="mpm-wiki">
                {/* Árvore de páginas */}
                <aside className="mpm-wiki__tree"
                    onDragOver={readOnly ? undefined : (e) => { e.preventDefault() }}
                    onDrop={readOnly ? undefined : (e) => { e.preventDefault(); if (dragId) movePage(dragId, null) }}>
                    <div className="mpm-wiki__tree-head">
                        <Icon name="book" /> <strong style={{ flex: 1 }}>Páginas</strong>
                        {!readOnly
                            ? <button className="mpm-btn mpm-btn--sm mpm-btn--primary" title="Nova página (raiz)" onClick={() => create(null)}>
                                <Icon name="plus" /> Página
                            </button>
                            : null}
                    </div>
                    {roots.length === 0
                        ? <div className="mpm-muted" style={{ padding: "var(--mp-space-3)", fontSize: 12 }}>
                            Nenhuma página ainda.{readOnly ? "" : " Crie a primeira acima."}
                        </div>
                        : <div className="mpm-doctree">{roots.map((r) => renderNode(r, 0))}</div>}
                </aside>

                {/* Conteúdo da página selecionada */}
                <section className="mpm-wiki__content">
                    {!selected
                        ? <EmptyState icon="book" title="Documentação do projeto"
                            hint={roots.length === 0
                                ? (readOnly ? "Este projeto ainda não tem documentação." : "Crie a primeira página para começar o wiki do projeto.")
                                : "Selecione uma página na árvore à esquerda."}
                            action={!readOnly && roots.length === 0
                                ? <button className="mpm-btn mpm-btn--primary" onClick={() => create(null)}><Icon name="plus" /> Nova página</button>
                                : undefined} />
                        : <div className="mpm-panel mpm-docpage">
                            {/* Trilha da página dentro da árvore */}
                            {ancestry.length > 1
                                ? <nav className="mpm-docpage__crumbs">
                                    {ancestry.map((a, i) =>
                                        <span key={a.id}>
                                            {i > 0 ? <Icon name="angle right" className="mpm-muted" /> : null}
                                            <a className={a.id === selected.id ? "mpm-docpage__crumb-current" : "mpm-crumbs__link"}
                                                onClick={() => select(a.id)}>{a.title}</a>
                                        </span>)}
                                </nav>
                                : null}

                            <div className="mpm-docpage__head">
                                {readOnly
                                    ? <h2 className="mpm-docpage__title">{selected.icon ? `${selected.icon} ` : ""}{selected.title}</h2>
                                    : <input className="mpm-input mpm-docpage__title-input" defaultValue={selected.title}
                                        key={`title-${selected.id}-${selected.updatedAt || ""}`}
                                        onBlur={(e) => saveTitle(selected, e.target.value)} />}
                                {!readOnly
                                    ? <div className="mpm-docpage__toolbar">
                                        <span className="mpm-iconbtn" data-tip="Mover para cima (entre irmãos)"
                                            onClick={() => reorder(selected, "up")} style={selIdx <= 0 ? { opacity: .35, pointerEvents: "none" } : undefined}><Icon name="arrow up" /></span>
                                        <span className="mpm-iconbtn" data-tip="Mover para baixo (entre irmãos)"
                                            onClick={() => reorder(selected, "down")} style={selIdx < 0 || selIdx >= siblings.length - 1 ? { opacity: .35, pointerEvents: "none" } : undefined}><Icon name="arrow down" /></span>
                                        <span className="mpm-iconbtn" data-tip="Nova sub-página" onClick={() => create(selected.id)}><Icon name="sitemap" /></span>
                                        {!editing
                                            ? <button className="mpm-btn mpm-btn--sm" onClick={() => setEditing(true)}><Icon name="pencil" /> Editar</button>
                                            : null}
                                        {/* Feedback para a IA sobre ESTA página (entityId = id da página):
                                            o agente pega "o feedback desta página" via MCP (scope=doc-page). */}
                                        <PageFeedbackButton scope="doc-page" projectId={projectId} entityId={selected.id}
                                            label={`Documentação — ${selected.title}`} compact />
                                        <span className="mpm-iconbtn" data-tip="Excluir esta página (e sub-páginas)" onClick={() => setConfirmDelete(selected)}><Icon name="trash" /></span>
                                    </div>
                                    : null}
                            </div>

                            {editing && !readOnly
                                ? <div className="mpm-desc mpm-desc--inline"
                                    {...feedbackTarget({ entityType: "doc-page", entityId: selected.id, project: projectId, field: "doc", fieldLabel: `Documentação — ${selected.title}` })}>
                                    <DescriptionEditor key={`doc-${selected.id}`} value={selected.body || ""}
                                        label={`página "${selected.title}"`}
                                        onSave={(md) => saveBody(selected, md)}
                                        onDone={() => setEditing(false)} />
                                </div>
                                : selected.body
                                ? <Markdown>{selected.body}</Markdown>
                                : <div className="mpm-tabpanel-empty">
                                    <Icon name="file alternate outline" size="large" />
                                    <div>Esta página ainda não tem conteúdo.</div>
                                    {!readOnly
                                        ? <button className="mpm-btn mpm-btn--sm mpm-btn--primary" onClick={() => setEditing(true)}>
                                            <Icon name="pencil" /> Escrever
                                        </button>
                                        : null}
                                </div>}

                            {/* Anexos de arquivo da página (imagem/PDF/log/artefato). A imagem
                                embutida na descrição continua sendo data-URI no markdown. */}
                            <div className="mpm-docpage__attachments">
                                <DocAttachmentPanel docPageId={selected.id} readOnly={readOnly} />
                            </div>
                        </div>}
                </section>
            </div>}

        {confirmDelete
            ? <ConfirmActionModal
                title="Excluir página"
                danger
                message={<>Excluir a página <strong>{confirmDelete.title}</strong>?</>}
                consequences={[
                    <>As sub-páginas também são removidas (soft delete — reversível por um administrador).</>
                ]}
                confirmLabel="Excluir página"
                busy={deleting}
                error={error}
                onConfirm={doDelete}
                onCancel={() => setConfirmDelete(null)} />
            : null}
        </AppShell>
    </ItemNavigatorProvider>
}

export default DocsPage
