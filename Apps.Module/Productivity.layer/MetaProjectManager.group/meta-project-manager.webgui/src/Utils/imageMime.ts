import { Attachment } from "../api/types"

// MIME de imagem por extensão — usado para montar data URIs de preview quando o
// anexo não guardou mimeType (upload/CLI/agente muitas vezes não o envia). SVG é
// o caso que mais importa aqui: sem "image/svg+xml" o <img> não renderiza.
const IMAGE_MIME_BY_EXT: Record<string, string> = {
    svg:  "image/svg+xml",
    png:  "image/png",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    gif:  "image/gif",
    webp: "image/webp",
    bmp:  "image/bmp",
    avif: "image/avif",
    ico:  "image/x-icon"
}

export const IMAGE_EXTS = Object.keys(IMAGE_MIME_BY_EXT)

const extOf = (name?: string): string => {
    if (!name) return ""
    const i = name.lastIndexOf(".")
    return i >= 0 ? name.slice(i + 1).toLowerCase() : ""
}

// Um anexo é imagem se o mime OU a extensão indicam imagem.
export const isImageAttachment = (a: Attachment): boolean => {
    const mime = (a.mimeType || "").toLowerCase()
    if (mime.indexOf("image/") === 0) return true
    return IMAGE_EXTS.indexOf(extOf(a.name)) >= 0
}

// Melhor MIME de imagem para o anexo: prioriza o mimeType gravado; senão infere
// pela extensão; fallback genérico.
export const imageMimeOf = (name?: string, mimeType?: string): string => {
    const mt = (mimeType || "").toLowerCase()
    if (mt.indexOf("image/") === 0) return mt
    return IMAGE_MIME_BY_EXT[extOf(name)] || "application/octet-stream"
}

// Monta um data URI de imagem a partir do conteúdo base64 (IPC readContent),
// forçando o MIME correto (essencial para SVG renderizar em <img>).
export const imageDataUri = (name: string | undefined, mimeType: string | undefined, base64: string): string =>
    `data:${imageMimeOf(name, mimeType)};base64,${base64}`
