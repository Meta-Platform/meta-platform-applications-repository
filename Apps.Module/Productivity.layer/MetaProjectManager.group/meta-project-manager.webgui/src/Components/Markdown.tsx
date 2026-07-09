import * as React from "react"
import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"

import useItemNavigator from "../Hooks/useItemNavigator"
import linkifyItemKeys, { ITEM_REF_ATTR } from "../Utils/linkifyItemKeys"

// Render real de Markdown (frente D). marked converte o texto e o DOMPurify
// sanitiza o HTML resultante (defesa contra XSS em conteúdo de itens/comentários
// escritos por humanos ou agentes). Usado em descrições, comentários, objetivo
// de sessão e preview de anexos markdown.
marked.setOptions({ gfm: true, breaks: true })

export const renderMarkdown = (text?: string): string => {
    if (!text) return ""
    const raw = marked.parse(text) as string
    // DOMPurify precisa manter o atributo que marca uma referência de item.
    return DOMPurify.sanitize(raw, { ADD_ATTR: [ITEM_REF_ATTR] })
}

interface MarkdownProps {
    children?: string
    className?: string
}

const Markdown = ({ children, className }: MarkdownProps) => {
    const nav = useItemNavigator()

    const html = useMemo(() => {
        const rendered = renderMarkdown(children)
        return nav ? linkifyItemKeys(rendered, nav.isKnownKey) : rendered
    }, [children, nav])

    // Delegação: um único handler cobre todas as referências do texto.
    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!nav) return
        const target = e.target as HTMLElement
        const anchor = target.closest(`[${ITEM_REF_ATTR}]`)
        if (!anchor) return
        e.preventDefault()
        const ref = anchor.getAttribute(ITEM_REF_ATTR)
        if (ref) nav.openItem(ref)
    }

    if (!children || !children.trim())
        return <span className="mpm-muted" style={{ fontSize: "12px" }}>—</span>

    return <div
        className={`mpm-md ${className || ""}`}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }} />
}

export default Markdown
