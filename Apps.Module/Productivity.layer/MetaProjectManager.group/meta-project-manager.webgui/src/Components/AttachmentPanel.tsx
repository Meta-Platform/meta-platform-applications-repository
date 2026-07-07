import * as React from "react"
import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Attachment } from "../api/types"
import { ErrorBanner } from "./Primitives"
import GetAttachmentDownloadUrl from "../Utils/GetAttachmentDownloadUrl"

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

    const load = () => api.attachments.list(itemId)
        .then((l) => setItems(l || []))
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

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
            setBusy(true); setError(null)
            try {
                const result = String(reader.result || "")
                const base64 = result.indexOf(",") >= 0 ? result.split(",")[1] : result
                await api.attachments.add(itemId, { name: file.name, base64 })
                await load()
            } catch (err: any) { setError(err.message) } finally { setBusy(false) }
        }
        reader.readAsDataURL(file)
    }

    const remove = async (id: string) => {
        setError(null)
        try { await api.attachments.remove(id); await load() }
        catch (e: any) { setError(e.message) }
    }

    const isLink = (a: Attachment) => a.type === "link" || (!!a.externalUrl && !a.storagePath)

    // Link -> abre externalUrl. Arquivo -> abre a URL binária de DownloadAttachment
    // resolvida do serverManagerInformation (indisponível no Electron GUI-host).
    const open = (a: Attachment) => {
        if (isLink(a)) { if (a.externalUrl) window.open(a.externalUrl, "_blank") ; return }
        const url = GetAttachmentDownloadUrl(serverManagerInformation, a.id)
        if (url) window.open(url, "_blank")
    }

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="paperclip" /> Anexos ({items.length})</div>
        <ErrorBanner error={error} />
        {items.map((a) => {
            const link = isLink(a)
            // arquivo só é baixável se conseguimos resolver a URL (browser, não Electron)
            const downloadUrl = link ? undefined : GetAttachmentDownloadUrl(serverManagerInformation, a.id)
            const canOpen = link ? !!a.externalUrl : !!downloadUrl
            return <div key={a.id} className="mpm-attach">
                <Icon name={link ? "linkify" : "file outline"} />
                <span className="mpm-attach__name" title={a.name}>{a.name}</span>
                {canOpen
                    ? <span className="mpm-iconbtn mpm-btn--sm" title={link ? "Abrir link" : "Baixar"} onClick={() => open(a)}>
                        <Icon name={link ? "external" : "download"} />
                    </span>
                    : null}
                <span className="mpm-iconbtn mpm-btn--sm" title="Remover" onClick={() => remove(a.id)}><Icon name="trash" /></span>
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
            <label className="mpm-btn mpm-btn--ghost mpm-btn--sm" style={{ cursor: "pointer" }}>
                <Icon name="upload" /> Upload arquivo
                <input type="file" style={{ display: "none" }} onChange={onFile} />
            </label>
        </div>
    </div>
}

export default AttachmentPanel
