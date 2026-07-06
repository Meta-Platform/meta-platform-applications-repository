import * as React from "react"

// Renderiza trechos inline: `código`, **negrito**, [texto](url).
const renderInline = (text:string, keyBase:string) => {
    const parts:any[] = []
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
    let last = 0, m:any, i = 0
    while((m = regex.exec(text)) !== null){
        if(m.index > last) parts.push(text.slice(last, m.index))
        const tok = m[0]
        if(tok.startsWith("`"))
            parts.push(<code key={`${keyBase}-${i++}`} style={{background:"rgba(128,128,128,0.18)", padding:"1px 5px", borderRadius:3, fontSize:"0.88em", fontFamily:"monospace"}}>{tok.slice(1, -1)}</code>)
        else if(tok.startsWith("**"))
            parts.push(<strong key={`${keyBase}-${i++}`}>{tok.slice(2, -2)}</strong>)
        else {
            const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
            if(mm) parts.push(<a key={`${keyBase}-${i++}`} href={mm[2]} target="_blank" rel="noreferrer">{mm[1]}</a>)
        }
        last = m.index + tok.length
    }
    if(last < text.length) parts.push(text.slice(last))
    return parts
}

const isHeading  = (l:string) => /^#{1,6}\s/.test(l)
const isBullet   = (l:string) => /^\s*[-*]\s+/.test(l)
const isQuote    = (l:string) => /^\s*>\s?/.test(l)
const isTableRow = (l:string) => l.indexOf("|") > -1
// Linha separadora de tabela: só pipes, hífens, dois-pontos e espaços, com ao menos um hífen.
const isTableSep = (l:string) => isTableRow(l) && /-/.test(l) && /^[\s|:-]+$/.test(l.trim())
const splitCells = (l:string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())

const cell:any = { border:"1px solid rgba(128,128,128,0.3)", padding:"4px 8px", textAlign:"left", verticalAlign:"top" }

// Renderizador markdown-lite, sem dependência externa (evita inflar o build em
// runtime). Suporta títulos, listas, tabelas (GFM), citações, blocos de código,
// negrito, código inline e links. Seguro: não injeta HTML cru.
const Markdown = ({ text }:any) => {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n")
    const blocks:any[] = []
    let i = 0, key = 0

    while(i < lines.length){
        const line = lines[i]

        // Bloco de código cercado
        if(line.startsWith("```")){
            const buf:string[] = []
            i++
            while(i < lines.length && !lines[i].startsWith("```")){ buf.push(lines[i]); i++ }
            i++
            blocks.push(<pre key={key++} style={{background:"rgba(128,128,128,0.14)", border:"1px solid rgba(128,128,128,0.25)", padding:10, borderRadius:6, overflow:"auto", fontSize:"0.85em"}}><code>{buf.join("\n")}</code></pre>)
            continue
        }

        // Título
        const h = /^(#{1,6})\s+(.*)$/.exec(line)
        if(h){
            const Tag:any = `h${Math.min(h[1].length + 2, 6)}`
            blocks.push(<Tag key={key++} style={{margin:"10px 0 4px"}}>{renderInline(h[2], "h" + key)}</Tag>)
            i++; continue
        }

        // Tabela (GFM): linha com pipes seguida de linha separadora
        if(isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])){
            const header = splitCells(line)
            i += 2
            const rows:string[][] = []
            while(i < lines.length && isTableRow(lines[i]) && lines[i].trim() !== "" && !isTableSep(lines[i])){
                rows.push(splitCells(lines[i])); i++
            }
            blocks.push(
                <div key={key++} style={{overflowX:"auto", margin:"6px 0"}}>
                    <table style={{borderCollapse:"collapse", fontSize:"0.84em"}}>
                        <thead><tr>{ header.map((c, ci) => <th key={ci} style={{...cell, background:"rgba(128,128,128,0.14)", fontWeight:700}}>{renderInline(c, `th${key}-${ci}`)}</th>) }</tr></thead>
                        <tbody>{ rows.map((r, ri) => <tr key={ri}>{ header.map((_, ci) => <td key={ci} style={cell}>{renderInline(r[ci] || "", `td${key}-${ri}-${ci}`)}</td>) }</tr>) }</tbody>
                    </table>
                </div>)
            continue
        }

        // Citação
        if(isQuote(line)){
            const buf:string[] = []
            while(i < lines.length && isQuote(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/, "")); i++ }
            blocks.push(<blockquote key={key++} style={{margin:"6px 0", padding:"2px 12px", borderLeft:"3px solid rgba(128,128,128,0.4)", opacity:0.85}}>{renderInline(buf.join(" "), "q" + key)}</blockquote>)
            continue
        }

        // Lista
        if(isBullet(line)){
            const items:any[] = []
            while(i < lines.length && isBullet(lines[i])){
                items.push(<li key={items.length}>{renderInline(lines[i].replace(/^\s*[-*]\s+/, ""), "li" + i)}</li>); i++
            }
            blocks.push(<ul key={key++} style={{margin:"4px 0", paddingLeft:20}}>{items}</ul>)
            continue
        }

        if(line.trim() === ""){ i++; continue }

        // Parágrafo (agrupa linhas até um bloco especial)
        const buf:string[] = []
        while(i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !isHeading(lines[i]) && !isBullet(lines[i]) && !isQuote(lines[i]) && !isTableRow(lines[i])){
            buf.push(lines[i]); i++
        }
        if(buf.length) blocks.push(<p key={key++} style={{margin:"4px 0", lineHeight:1.5}}>{renderInline(buf.join(" "), "p" + key)}</p>)
        else if(i < lines.length && lines[i].trim() !== "" && lines[i].indexOf("|") > -1){
            // linha com pipe solta (sem separador de tabela) — trata como parágrafo simples
            blocks.push(<p key={key++} style={{margin:"4px 0", lineHeight:1.5}}>{renderInline(lines[i], "pp" + key)}</p>); i++
        }
    }

    return <div style={{wordBreak:"break-word"}}>{blocks}</div>
}

export default Markdown
