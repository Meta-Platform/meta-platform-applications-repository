import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import { Attachment } from "../api/types"
import Markdown from "./Markdown"

const extOf = (name?: string) => {
    if (!name) return ""
    const i = name.lastIndexOf(".")
    return i >= 0 ? name.slice(i + 1).toLowerCase() : ""
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]
const TEXT_EXT = ["md", "markdown", "txt", "json", "csv", "log", "yml", "yaml", "ts", "js", "py", "sh"]
const MD_EXT = ["md", "markdown"]

type Kind = "image" | "pdf" | "markdown" | "text" | "link" | "none"

const kindOf = (a: Attachment, isLink: boolean): Kind => {
    if (isLink) return "link"
    const mime = (a.mimeType || "").toLowerCase()
    const ext = extOf(a.name)
    if (mime.indexOf("image/") === 0 || IMAGE_EXT.indexOf(ext) >= 0) return "image"
    if (mime === "application/pdf" || ext === "pdf") return "pdf"
    if (MD_EXT.indexOf(ext) >= 0) return "markdown"
    if (mime.indexOf("text/") === 0 || TEXT_EXT.indexOf(ext) >= 0) return "text"
    return "none"
}

interface AttachmentPreviewProps {
    attachment: Attachment
    downloadUrl?: string    // undefined no Electron / arquivo não resolvível
    isLink: boolean
}

// Preview inline de anexo (frente C / spec §4.5): imagem, PDF, texto/markdown.
// Texto é buscado por fetch da URL de download (só disponível no browser).
const AttachmentPreview = ({ attachment, downloadUrl, isLink }: AttachmentPreviewProps) => {
    const kind = kindOf(attachment, isLink)
    const [text, setText] = useState<string | null>(null)
    const [textError, setTextError] = useState<string | null>(null)

    useEffect(() => {
        if ((kind === "text" || kind === "markdown") && downloadUrl) {
            let alive = true
            setText(null); setTextError(null)
            fetch(downloadUrl)
                .then((r) => r.text())
                .then((t) => { if (alive) setText(t) })
                .catch((e) => { if (alive) setTextError(String(e && e.message || e)) })
            return () => { alive = false }
        }
    }, [kind, downloadUrl])

    if (isLink)
        return <div className="mpm-attach__preview">
            <a href={attachment.externalUrl} target="_blank" rel="noreferrer">{attachment.externalUrl}</a>
        </div>

    if (!downloadUrl)
        return <div className="mpm-attach__preview mpm-muted" style={{ fontSize: "12px" }}>
            <Icon name="info circle" /> Preview de arquivo local indisponível neste ambiente.
        </div>

    if (kind === "image")
        return <div className="mpm-attach__preview">
            <img src={downloadUrl} alt={attachment.name} style={{ maxWidth: "100%", border: "var(--mp-border-thin)" }} />
        </div>

    if (kind === "pdf")
        return <div className="mpm-attach__preview">
            <iframe src={downloadUrl} title={attachment.name} style={{ width: "100%", height: "360px", border: "var(--mp-border-thin)" }} />
        </div>

    if (kind === "markdown" || kind === "text") {
        if (textError) return <div className="mpm-error-banner" style={{ fontSize: "12px" }}>{textError}</div>
        if (text === null) return <div className="mpm-muted" style={{ fontSize: "12px" }}><Icon name="circle notch" loading /> carregando...</div>
        return <div className="mpm-attach__preview">
            {kind === "markdown"
                ? <Markdown>{text}</Markdown>
                : <pre className="mpm-code-block">{text}</pre>}
        </div>
    }

    return <div className="mpm-attach__preview mpm-muted" style={{ fontSize: "12px" }}>
        <Icon name="file outline" /> Sem preview para este tipo — use baixar.
    </div>
}

export default AttachmentPreview
export { kindOf }
