import * as React from "react"
import { useCallback } from "react"
import { MarkdownView, RenderMarkdown } from "@i-components/components/advanced/authoring"

import useItemNavigator from "../Hooks/useItemNavigator"
import linkifyItemKeys, { ITEM_REF_ATTR } from "../Utils/linkifyItemKeys"

// A conversão e a SANITIZAÇÃO do markdown são do kit (`MarkdownView` — este
// arquivo foi a origem dele). O que fica aqui é o que é do MPM: transformar as
// chaves de item (MPMB-12) em referências navegáveis e abrir o item no clique.

// Markdown -> HTML sanitizado, preservando o atributo que marca uma referência
// de item. Exportado porque telas que exportam/medem o HTML partem daqui.
export const renderMarkdown = (text?: string): string =>
    RenderMarkdown(text, { allowAttributes: [ITEM_REF_ATTR] })

interface MarkdownProps {
    children?: string
    className?: string
}

const Markdown = ({ children, className }: MarkdownProps) => {
    const nav = useItemNavigator()

    const transformHtml = useCallback(
        (html: string) => nav ? linkifyItemKeys(html, nav.isKnownKey) : html,
        [nav])

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

    return <MarkdownView
        className={`mpm-md ${className || ""}`}
        allowAttributes={[ITEM_REF_ATTR]}
        transformHtml={transformHtml}
        onClick={onClick}
        empty={<span className="mpm-muted" style={{ fontSize: "12px" }}>—</span>}>
        {children}
    </MarkdownView>
}

export default Markdown
