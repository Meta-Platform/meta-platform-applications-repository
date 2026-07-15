import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { Attachment } from "../api/types"
import Markdown from "./Markdown"
import { isImageAttachment, imageDataUri, imageMimeOf } from "../Utils/imageMime"

const extOf = (name?: string) => {
    if (!name) return ""
    const i = name.lastIndexOf(".")
    return i >= 0 ? name.slice(i + 1).toLowerCase() : ""
}

const TEXT_EXT = ["md", "markdown", "txt", "json", "csv", "log", "yml", "yaml", "ts", "js", "py", "sh"]
const MD_EXT = ["md", "markdown"]

type Kind = "image" | "pdf" | "markdown" | "text" | "link" | "none"

const kindOf = (a: Attachment, isLink: boolean): Kind => {
    if (isLink) return "link"
    const mime = (a.mimeType || "").toLowerCase()
    const ext = extOf(a.name)
    if (isImageAttachment(a)) return "image"
    if (mime === "application/pdf" || ext === "pdf") return "pdf"
    if (MD_EXT.indexOf(ext) >= 0) return "markdown"
    if (mime.indexOf("text/") === 0 || TEXT_EXT.indexOf(ext) >= 0) return "text"
    return "none"
}

// Decodifica base64 → texto UTF-8 (para preview de texto/markdown via IPC).
const decodeBase64Utf8 = (b64: string): string => {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    try { return new TextDecoder("utf-8").decode(bytes) } catch (_) { return bin }
}

interface AttachmentPreviewProps {
    attachment: Attachment
    downloadUrl?: string    // URL HTTP (só browser); ausente no Electron GUI-host
    isLink: boolean
    // limita a altura da imagem (thumbnail em comentários); undefined = tamanho pleno
    maxHeight?: number
    // lê o conteúdo (base64) do anexo — default: anexo de ITEM. Anexos de página de
    // documentação injetam o leitor da API de docs (mesmo formato de retorno).
    readContent?: (id: string) => Promise<{ name: string; mimeType?: string; base64: string; sizeBytes?: number }>
}

// Preview inline de anexo: imagem (inclui SVG), PDF, texto/markdown.
//
// SEGURANÇA (SVG): a imagem SEMPRE é exibida via <img src="data:image/svg+xml…"> —
// NUNCA injetada como markup no DOM. Em <img>, o SVG é renderizado isolado: não
// executa scripts nem faz requisições externas, então é seguro revisar ícones
// gerados por agentes sem risco de XSS.
//
// No desktop (Electron GUI-host) não há URL HTTP: o conteúdo é lido por IPC
// (ReadAttachmentContent → base64) e vira um data URI. No browser, imagem também
// usa data URI (garante o content-type correto do SVG, que o download bruto não dá).
const AttachmentPreview = ({ attachment, downloadUrl, isLink, maxHeight, readContent }: AttachmentPreviewProps) => {
    const api = useApi()
    const readAttachment = readContent || ((id: string) => api.attachments.readContent(id))
    const kind = kindOf(attachment, isLink)
    const [src, setSrc] = useState<string | null>(null)
    const [text, setText] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let alive = true
        setSrc(null); setText(null); setError(null)

        // Link: usa a URL externa direto (imagem remota renderiza em <img>).
        if (isLink) { if (attachment.externalUrl) setSrc(attachment.externalUrl); return }

        const wantsContent = kind === "image" || kind === "pdf" || kind === "text" || kind === "markdown"
        if (!wantsContent) return

        // Texto/markdown com URL HTTP: busca direto (mais leve que base64).
        if ((kind === "text" || kind === "markdown") && downloadUrl) {
            setLoading(true)
            fetch(downloadUrl).then((r) => r.text())
                .then((t) => { if (alive) { setText(t); setLoading(false) } })
                .catch((e) => { if (alive) { setError(String(e && e.message || e)); setLoading(false) } })
            return () => { alive = false }
        }
        // PDF com URL HTTP: iframe aponta para a URL.
        if (kind === "pdf" && downloadUrl) { setSrc(downloadUrl); return }

        // Demais casos (imagem sempre; PDF/texto no desktop sem URL): lê o conteúdo
        // por IPC e monta data URI / texto decodificado.
        setLoading(true)
        readAttachment(attachment.id)
            .then((c) => {
                if (!alive) return
                if (kind === "image") setSrc(imageDataUri(c.name, c.mimeType, c.base64))
                else if (kind === "pdf") setSrc(`data:${c.mimeType || "application/pdf"};base64,${c.base64}`)
                else setText(decodeBase64Utf8(c.base64))
                setLoading(false)
            })
            .catch((e) => { if (alive) { setError(e.message || "Falha ao carregar o anexo"); setLoading(false) } })
        return () => { alive = false }
    }, [attachment.id, kind, downloadUrl, isLink, api])

    if (error)
        return <div className="mpm-error-banner" style={{ fontSize: "12px" }}><Icon name="warning circle" /> {error}</div>

    if (loading)
        return <div className="mpm-muted" style={{ fontSize: "12px" }}><Icon name="circle notch" loading /> carregando…</div>

    if (isLink && kind === "link" && !isImageAttachment(attachment))
        return <div className="mpm-attach__preview">
            <a href={attachment.externalUrl} target="_blank" rel="noreferrer">{attachment.externalUrl}</a>
        </div>

    if (kind === "image" || (isLink && isImageAttachment(attachment))) {
        if (!src) return null
        // fundo xadrez ajuda a ver transparência de ícones (PNG/SVG).
        return <div className="mpm-attach__preview mpm-attach__preview--img">
            <img src={src} alt={attachment.name}
                title={imageMimeOf(attachment.name, attachment.mimeType)}
                style={{ maxWidth: "100%", maxHeight: maxHeight ? `${maxHeight}px` : undefined, border: "var(--mp-border-thin)" }} />
        </div>
    }

    if (kind === "pdf") {
        if (!src) return null
        return <div className="mpm-attach__preview">
            <iframe src={src} title={attachment.name} style={{ width: "100%", height: "360px", border: "var(--mp-border-thin)" }} />
        </div>
    }

    if (kind === "markdown" || kind === "text") {
        if (text === null) return null
        return <div className="mpm-attach__preview">
            {kind === "markdown" ? <Markdown>{text}</Markdown> : <pre className="mpm-code-block">{text}</pre>}
        </div>
    }

    return <div className="mpm-attach__preview mpm-muted" style={{ fontSize: "12px" }}>
        <Icon name="file outline" /> Sem preview para este tipo — use baixar.
    </div>
}

export default AttachmentPreview
export { kindOf }
