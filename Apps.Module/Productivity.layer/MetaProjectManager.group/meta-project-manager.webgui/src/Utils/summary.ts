// Resumo de uma linha a partir de uma descrição em markdown.
//
// As listas mostram o título e pouco mais; quem está priorizando precisa de um
// fiapo do conteúdo para decidir sem abrir cada item. Como as descrições vêm
// estruturadas (títulos de seção, listas, código), pegar os primeiros N
// caracteres crus resultaria em "## Problema A superfície MCP tem `create_...".
//
// Então: descartamos títulos, blocos de código e citações, e usamos o primeiro
// parágrafo de prosa que sobrar.
const stripInline = (line: string): string =>
    line
        .replace(/`([^`]+)`/g, "$1")            // código inline
        .replace(/\*\*([^*]+)\*\*/g, "$1")      // negrito
        .replace(/\*([^*]+)\*/g, "$1")          // itálico
        .replace(/~~([^~]+)~~/g, "$1")          // tachado
        .replace(/<\/?u>/g, "")                 // sublinhado (html)
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links: fica o texto
        .replace(/^\s*[-*+]\s+/, "")            // marcador de lista
        .replace(/^\s*\d+\.\s+/, "")            // lista numerada
        .replace(/^\s*>\s?/, "")                // citação
        .trim()

export const summarize = (markdown?: string, maxLength = 160): string => {
    if (!markdown) return ""

    const lines = markdown.split("\n")
    const parts: string[] = []
    let inFence = false

    for (const raw of lines) {
        const line = raw.trim()
        if (line.startsWith("```")) { inFence = !inFence; continue }
        if (inFence) continue
        if (!line) { if (parts.length > 0) break; continue }   // fim do 1º parágrafo
        if (line.startsWith("#")) continue                     // título de seção
        if (/^[-|:\s]+$/.test(line)) continue                  // separador / linha de tabela

        const clean = stripInline(line)
        if (clean) parts.push(clean)
    }

    const text = parts.join(" ").replace(/\s+/g, " ").trim()
    if (text.length <= maxLength) return text
    // corta na última palavra inteira
    const cut = text.slice(0, maxLength)
    const lastSpace = cut.lastIndexOf(" ")
    return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export default summarize
