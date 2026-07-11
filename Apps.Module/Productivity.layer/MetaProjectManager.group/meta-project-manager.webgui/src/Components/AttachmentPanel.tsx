import * as React from "react"
import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Attachment } from "../api/types"
import { ErrorBanner } from "./Primitives"
import GetAttachmentDownloadUrl from "../Utils/GetAttachmentDownloadUrl"
import { triggerBase64Download } from "../Utils/triggerDownload"
import AttachmentPreview from "./AttachmentPreview"
import { formatDateTime } from "../Utils/format"

// AttachmentPanel (spec §11.1): lista anexos do item; permite adicionar link
// ou upload (arquivo -> base64) e remover.
const AttachmentPanel = ({ itemId }: { itemId: string }) => {
    const api = useApi()
    const serverManagerInformation = useSelector((state: any) => state.HTTPServerManager)
    const [items, setItems] = useState<Attachment[]>([])
    const [linkUrl, setLinkUrl] = useState("")
    const [linkName, setLinkName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [dragging, setDragging] = useState(false)
    const [preview, setPreview] = useState<{ [id: string]: boolean }>({})

    // apenas anexos do item (os de comentário aparecem sob o comentário)
    const load = () => api.attachments.list(itemId)
        .then((l) => setItems((l || []).filter((a) => !a.commentId)))
        .catch((e) => setError(e.message))

    useEffect(() => { load() }, [itemId])

    const addLink = async () => {
        if (!linkUrl.trim()) return
        setBusy(true); setError(null)
        try {
            await api.attachments.add(itemId, { url: linkUrl.trim(), name: linkName.trim() || linkUrl.trim() })
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

    // Upload de um ou vários arquivos (botão ou arrastar). Sobe em sequência para
    // um erro num arquivo não derrubar os outros.
    const uploadFiles = async (files: File[]) => {
        if (!files.length) return
        setBusy(true); setError(null)
        try {
            for (const file of files) {
                try {
                    const base64 = await readBase64(file)
                    await api.attachments.add(itemId, { name: file.name, base64 })
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

    // Metadados legíveis: tamanho e data (o que ajuda a reconhecer o anexo).
    const humanSize = (bytes?: number) => {
        if (!bytes && bytes !== 0) return ""
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    const remove = async (id: string) => {
        setError(null)
        try { await api.attachments.remove(id); await load() }
        catch (e: any) { setError(e.message) }
    }

    const isLink = (a: Attachment) => a.type === "link" || (!!a.externalUrl && !a.storagePath)

    // Link -> abre externalUrl. Arquivo (browser) -> abre a URL binária de
    // DownloadAttachment. Arquivo (Electron GUI-host, sem URL HTTP) -> baixa via
    // IPC (ReadAttachmentContent devolve base64) usando data URI.
    const open = async (a: Attachment) => {
        if (isLink(a)) { if (a.externalUrl) window.open(a.externalUrl, "_blank") ; return }
        const url = GetAttachmentDownloadUrl(serverManagerInformation, a.id)
        if (url) { window.open(url, "_blank"); return }
        try {
            const c = await api.attachments.readContent(a.id)
            triggerBase64Download(c.name, c.mimeType, c.base64)
        } catch (e: any) {
            setError(e?.message || "Falha ao baixar anexo")
        }
    }

    return <div className={`mpm-col mpm-attach-drop ${dragging ? "is-dragging" : ""}`}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        <div className="mpm-section-title"><Icon name="paperclip" /> Anexos ({items.length})</div>
        <ErrorBanner error={error} />
        {dragging
            ? <div className="mpm-attach-drop__hint"><Icon name="upload" /> Solte os arquivos para anexar</div>
            : null}
        {items.map((a) => {
            const link = isLink(a)
            // arquivo só é baixável se conseguimos resolver a URL (browser, não Electron)
            const downloadUrl = link ? undefined : GetAttachmentDownloadUrl(serverManagerInformation, a.id)
            // arquivo é sempre baixável: por URL no browser ou via IPC (base64) no Electron
            const canOpen = link ? !!a.externalUrl : true
            // preview disponível para links (externalUrl) e arquivos com URL resolvida
            const canPreview = link ? !!a.externalUrl : !!downloadUrl
            const isOpen = !!preview[a.id]
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
                        ? <span className="mpm-iconbtn mpm-btn--sm" title="Pré-visualizar"
                            onClick={() => setPreview((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                            <Icon name={isOpen ? "eye slash" : "eye"} />
                        </span>
                        : null}
                    {canOpen
                        ? <span className="mpm-iconbtn mpm-btn--sm" title={link ? "Abrir link" : "Baixar"} onClick={() => open(a)}>
                            <Icon name={link ? "external" : "download"} />
                        </span>
                        : null}
                    <span className="mpm-iconbtn mpm-btn--sm" title="Remover" onClick={() => remove(a.id)}><Icon name="trash" /></span>
                </div>
                {isOpen
                    ? <AttachmentPreview attachment={a} downloadUrl={downloadUrl} isLink={link} />
                    : null}
            </div>
        })}
        <div className="mpm-col">
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
        </div>
    </div>
}

export default AttachmentPanel
