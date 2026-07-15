import * as React from "react"
import { useCallback, useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Attachment } from "../api/types"
import { ErrorBanner } from "./Primitives"
import { triggerBase64Download } from "../Utils/triggerDownload"
import AttachmentPreview, { kindOf } from "./AttachmentPreview"
import { formatDateTime } from "../Utils/format"
import { isImageAttachment } from "../Utils/imageMime"

// Painel de anexos de uma PÁGINA de documentação. Espelha o AttachmentPanel do
// item, mas fala com a API de docs (anexos são doc-page-scoped) e baixa/pré-
// visualiza sempre por conteúdo base64 — não há URL HTTP de arquivo para docs, e
// o base64 funciona igual no browser e no desktop Electron.
//
// A imagem embutida NA DESCRIÇÃO segue como data-URI no markdown (editor); este
// painel é para anexar arquivos de verdade (imagem/PDF/log/artefato) à página.
const DocAttachmentPanel = ({ docPageId, readOnly }: { docPageId: string; readOnly?: boolean }) => {
    const api = useApi()
    const [items, setItems] = useState<Attachment[]>([])
    const [linkUrl, setLinkUrl] = useState("")
    const [linkName, setLinkName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [preview, setPreview] = useState<{ [id: string]: boolean }>({})

    const load = useCallback(() => api.docs.listAttachments(docPageId)
        .then((l) => setItems(l || []))
        .catch((e) => setError(e.message)), [api, docPageId])

    useEffect(() => { load() }, [load])

    // Leitor de conteúdo desta API (injetado no AttachmentPreview).
    const readContent = useCallback((id: string) => api.docs.readAttachmentContent(id), [api])

    const addLink = async () => {
        if (!linkUrl.trim()) return
        setBusy(true); setError(null)
        try {
            await api.docs.addAttachment(docPageId, { url: linkUrl.trim(), name: linkName.trim() || linkUrl.trim() })
            setLinkUrl(""); setLinkName(""); await load()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const readBase64 = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const result = String(reader.result || "")
                resolve(result.indexOf(",") >= 0 ? result.split(",")[1] : result)
            }
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
        })

    const uploadFiles = async (files: File[]) => {
        if (!files.length) return
        setBusy(true); setError(null)
        try {
            for (const file of files) {
                try {
                    const base64 = await readBase64(file)
                    await api.docs.addAttachment(docPageId, { name: file.name, base64, mimeType: file.type || undefined })
                } catch (err: any) { setError(`Falha em "${file.name}": ${err.message}`) }
            }
            await load()
        } finally { setBusy(false) }
    }

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        uploadFiles(Array.from(e.target.files || []))
        e.target.value = ""
    }

    const onDrop = (e: React.DragEvent) => {
        setDragging(false)
        const files = Array.from(e.dataTransfer && e.dataTransfer.files || [])
        if (files.length) { e.preventDefault(); uploadFiles(files) }
    }
    const onDragOver = (e: React.DragEvent) => {
        if (Array.from(e.dataTransfer && e.dataTransfer.types || []).includes("Files")) {
            e.preventDefault(); if (!dragging) setDragging(true)
        }
    }
    const onDragLeave = (e: React.DragEvent) => {
        if (e.currentTarget === e.target) setDragging(false)
    }

    const humanSize = (bytes?: number) => {
        if (!bytes && bytes !== 0) return ""
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    const remove = async (id: string) => {
        setError(null)
        try { await api.docs.removeAttachment(id); await load() }
        catch (e: any) { setError(e.message) }
    }

    const isLink = (a: Attachment) => a.type === "link" || (!!a.externalUrl && !a.storagePath)

    // Link -> abre externalUrl. Arquivo -> baixa por base64 (browser e desktop).
    const open = async (a: Attachment) => {
        if (isLink(a)) { if (a.externalUrl) window.open(a.externalUrl, "_blank") ; return }
        try {
            const c = await api.docs.readAttachmentContent(a.id)
            triggerBase64Download(c.name, c.mimeType, c.base64)
        } catch (e: any) {
            setError(e?.message || "Falha ao baixar anexo")
        }
    }

    return <div className={`mpm-col mpm-attach-drop ${dragging ? "is-dragging" : ""}`}
        onDrop={readOnly ? undefined : onDrop} onDragOver={readOnly ? undefined : onDragOver} onDragLeave={readOnly ? undefined : onDragLeave}>
        <div className="mpm-section-title"><Icon name="paperclip" /> Anexos da página ({items.length})</div>
        <ErrorBanner error={error} />
        {dragging
            ? <div className="mpm-attach-drop__hint"><Icon name="upload" /> Solte os arquivos para anexar</div>
            : null}
        {items.map((a) => {
            const link = isLink(a)
            const canOpen = link ? !!a.externalUrl : true
            const previewKind = kindOf(a, link)
            const canPreview = link ? !!a.externalUrl : previewKind !== "none"
            const isOpen = a.id in preview ? preview[a.id] : isImageAttachment(a)
            return <div key={a.id} className="mpm-col" style={{ gap: "var(--mp-space-1)" }}>
                <div className="mpm-attach">
                    <Icon name={link ? "linkify" : "file outline"} />
                    <div className="mpm-attach__body">
                        <span className="mpm-attach__name" title={a.name}>{a.name}</span>
                        {!link && (a.sizeBytes || a.createdAt)
                            ? <span className="mpm-attach__meta mpm-muted">
                                {[humanSize(a.sizeBytes), a.createdAt ? formatDateTime(a.createdAt) : ""].filter(Boolean).join(" · ")}
                            </span>
                            : null}
                    </div>
                    {canPreview
                        ? <span className="mpm-iconbtn mpm-btn--sm" data-tip={isOpen ? "Ocultar a pré-visualização" : "Pré-visualizar o anexo"}
                            onClick={() => setPreview((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                            <Icon name={isOpen ? "eye slash" : "eye"} />
                        </span>
                        : null}
                    {canOpen
                        ? <span className="mpm-iconbtn mpm-btn--sm" data-tip={link ? "Abrir o link em nova aba" : "Baixar o arquivo"} onClick={() => open(a)}>
                            <Icon name={link ? "external" : "download"} />
                        </span>
                        : null}
                    {!readOnly
                        ? <span className="mpm-iconbtn mpm-btn--sm" data-tip="Remover o anexo" onClick={() => remove(a.id)}><Icon name="trash" /></span>
                        : null}
                </div>
                {isOpen
                    ? <AttachmentPreview attachment={a} isLink={link} maxHeight={420} readContent={readContent} />
                    : null}
            </div>
        })}
        {readOnly ? null : <div className="mpm-col">
            <input className="mpm-input" placeholder="Nome (opcional)" value={linkName}
                onChange={(e) => setLinkName(e.target.value)} />
            <div className="mpm-row">
                <input className="mpm-input" placeholder="https://..." value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)} />
                <button className="mpm-btn mpm-btn--sm" disabled={busy} onClick={addLink}>
                    <Icon name="linkify" /> Link
                </button>
            </div>
            <label className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ cursor: "pointer" }}
                title="Envie um ou vários arquivos (ou arraste-os para o painel)">
                <Icon name="upload" /> {busy ? "Enviando…" : "Upload arquivo"}
                <input type="file" multiple style={{ display: "none" }} onChange={onFile} disabled={busy} />
            </label>
        </div>}
    </div>
}

export default DocAttachmentPanel
