import * as React from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"

// Render real de Markdown (frente D). marked converte o texto e o DOMPurify
// sanitiza o HTML resultante (defesa contra XSS em conteúdo de itens/comentários
// escritos por humanos ou agentes). Usado em descrições, comentários, objetivo
// de sessão e preview de anexos markdown.
marked.setOptions({ gfm: true, breaks: true })

export const renderMarkdown = (text?: string): string => {
    if (!text) return ""
    const raw = marked.parse(text) as string
    return DOMPurify.sanitize(raw)
}

interface MarkdownProps {
    children?: string
    className?: string
}

const Markdown = ({ children, className }: MarkdownProps) => {
    if (!children || !children.trim())
        return <span className="mpm-muted" style={{ fontSize: "12px" }}>—</span>
    return <div
        className={`mpm-markdown mpm-md ${className || ""}`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }} />
}

export default Markdown
