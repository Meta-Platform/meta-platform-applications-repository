import * as React from "react"

// Decoração visual do status git na árvore: vermelho para "sem commitar",
// badge com a contagem de arquivos sujos e tooltip listando-os.

export const GIT_DIRTY_COLOR = "#e5534b"

export type GitEntry = { dirty:boolean, count:number, states?:string[], files?:string[] }

// Entrada de status de um caminho (nó da árvore) ou undefined se limpo.
export const gitEntry = (statusByPath:any, path?:string):GitEntry|undefined =>
    (path && statusByPath && statusByPath[path]) || undefined

// Estilo do rótulo de um nó sujo (texto em vermelho, seminegrito).
export const gitNameStyle = (entry?:GitEntry):React.CSSProperties =>
    entry ? { color: GIT_DIRTY_COLOR } : {}

// Tooltip com a amostra de arquivos sujos daquele nó.
export const gitTitle = (entry?:GitEntry):string|undefined => {
    if(!entry) return undefined
    const files = entry.files || []
    const header = `${entry.count} sem commitar`
    const list = files.map((f) => `• ${f}`).join("\n")
    const more = entry.count > files.length ? `\n… (+${entry.count - files.length})` : ""
    return `${header}\n${list}${more}`
}

// Badge discreto com a contagem de arquivos sujos sob o nó.
export const GitBadge = ({ entry }:{ entry?:GitEntry }) => {
    if(!entry) return null
    return <span title={gitTitle(entry)} style={{
        marginLeft: 6,
        padding: "0 6px",
        borderRadius: 9,
        fontSize: "0.7em",
        fontWeight: 700,
        lineHeight: "15px",
        display: "inline-block",
        color: "#fff",
        background: GIT_DIRTY_COLOR
    }}>{entry.count}</span>
}
