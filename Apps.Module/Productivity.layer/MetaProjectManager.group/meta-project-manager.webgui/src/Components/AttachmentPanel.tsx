import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Attachment } from "../api/types"
import { ErrorBanner } from "./Primitives"

// AttachmentPanel (spec §11.1): lista anexos do item; permite adicionar link
// ou upload (arquivo -> base64) e remover.
const AttachmentPanel = ({ itemId }: { itemId: string }) => {
    const api = useApi()
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

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="paperclip" /> Anexos ({items.length})</div>
        <ErrorBanner error={error} />
        {items.map((a) =>
            <div key={a.id} className="mpm-attach">
                <Icon name={a.type === "link" || a.externalUrl ? "linkify" : "file outline"} />
                <span className="mpm-attach__name" title={a.name}>{a.name}</span>
                <span className="mpm-iconbtn mpm-btn--sm" onClick={() => remove(a.id)}><Icon name="trash" /></span>
            </div>)}
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
