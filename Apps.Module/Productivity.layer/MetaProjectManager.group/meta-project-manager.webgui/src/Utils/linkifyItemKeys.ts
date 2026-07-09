// Transforma referências a itens (ex.: CFGEC-26, MPMB-9) em links clicáveis
// dentro de um HTML já renderizado e sanitizado.
//
// Só vira link a key cujo PREFIXO pertence a um projeto existente — sem isso,
// "UTF-8", "ISO-8601" ou "COVID-19" também virariam links.
//
// Não mexe dentro de <a> (já é link) nem de <pre> (bloco de código é literal);
// <code> inline É linkificado, porque é assim que as keys costumam aparecer.

const KEY_RE = /\b([A-Z][A-Z0-9]{1,9})-(\d+)\b/g
const SKIP_TAGS = ["A", "PRE"]

export const ITEM_REF_ATTR = "data-item-ref"

const insideSkippedTag = (node: Node): boolean => {
    let el = node.parentElement
    while (el) {
        if (SKIP_TAGS.indexOf(el.tagName) >= 0) return true
        el = el.parentElement
    }
    return false
}

// isKnownKey recebe a key inteira (ex.: "CFGEC-26") e decide se ela existe.
export const linkifyItemKeys = (html: string, isKnownKey: (key: string) => boolean): string => {
    if (!html || typeof document === "undefined") return html

    const root = document.createElement("div")
    root.innerHTML = html

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const targets: Text[] = []
    let current = walker.nextNode()
    while (current) {
        const text = current as Text
        if (KEY_RE.test(text.data) && !insideSkippedTag(text)) targets.push(text)
        KEY_RE.lastIndex = 0
        current = walker.nextNode()
    }

    targets.forEach((textNode) => {
        const frag = document.createDocumentFragment()
        let lastIndex = 0
        let match: RegExpExecArray | null
        KEY_RE.lastIndex = 0
        while ((match = KEY_RE.exec(textNode.data)) !== null) {
            const key = match[0]
            if (!isKnownKey(key)) continue
            if (match.index > lastIndex)
                frag.appendChild(document.createTextNode(textNode.data.slice(lastIndex, match.index)))
            const a = document.createElement("a")
            a.setAttribute(ITEM_REF_ATTR, key)
            a.setAttribute("href", "#")
            a.setAttribute("title", `Abrir ${key}`)
            a.className = "mpm-item-ref"
            a.textContent = key
            frag.appendChild(a)
            lastIndex = match.index + key.length
        }
        if (lastIndex === 0) return
        if (lastIndex < textNode.data.length)
            frag.appendChild(document.createTextNode(textNode.data.slice(lastIndex)))
        textNode.parentNode && textNode.parentNode.replaceChild(frag, textNode)
    })

    return root.innerHTML
}

export default linkifyItemKeys
