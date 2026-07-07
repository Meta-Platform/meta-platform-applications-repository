import * as React from "react"
import styled from "styled-components"

// Corpo do markdown com tipografia estilo GitHub/VSCode (tema-consciente).
const Body = styled.div`
    font-size: 14px;
    line-height: 1.6;
    word-wrap: break-word;

    & > *:first-child { margin-top: 0; }
    & h1, & h2, & h3, & h4, & h5, & h6 { margin: 22px 0 12px; font-weight: 600; line-height: 1.25; }
    & h1 { font-size: 1.7em; padding-bottom: .3em; border-bottom: 1px solid var(--mp-line-faint, rgba(127,127,127,.25)); }
    & h2 { font-size: 1.4em; padding-bottom: .3em; border-bottom: 1px solid var(--mp-line-faint, rgba(127,127,127,.25)); }
    & h3 { font-size: 1.2em; }
    & h4 { font-size: 1.05em; }
    & p { margin: 0 0 12px; }
    & ul, & ol { margin: 0 0 12px; padding-left: 1.7em; }
    & li { margin: .28em 0; }
    & li > ul, & li > ol { margin: .28em 0; }
    & a { color: var(--mp-accent, #1a7f78); text-decoration: none; }
    & a:hover { text-decoration: underline; }
    & strong { font-weight: 600; }
    & em { font-style: italic; }
    & code { background: rgba(127,127,127,.16); padding: .18em .4em; border-radius: 6px; font-family: var(--mp-font-code, monospace); font-size: .88em; }
    & pre { background: rgba(127,127,127,.10); border: 1px solid var(--mp-line-faint, rgba(127,127,127,.22)); border-radius: 8px; padding: 12px 14px; overflow: auto; margin: 0 0 14px; }
    & pre code { background: none; padding: 0; font-size: .86em; line-height: 1.5; }
    & blockquote { margin: 0 0 14px; padding: .3em 1em; border-left: 4px solid var(--mp-accent, rgba(127,127,127,.5)); opacity: .82; }
    & blockquote > *:last-child { margin-bottom: 0; }
    & table { border-collapse: collapse; margin: 0 0 14px; display: block; overflow: auto; max-width: 100%; }
    & th, & td { border: 1px solid var(--mp-line-faint, rgba(127,127,127,.3)); padding: 6px 13px; text-align: left; }
    & th { background: rgba(127,127,127,.10); font-weight: 600; }
    & tr:nth-child(2n) td { background: rgba(127,127,127,.04); }
    & hr { border: 0; border-top: 1px solid var(--mp-line-faint, rgba(127,127,127,.3)); margin: 20px 0; }
    & img { max-width: 100%; }
`

// Inline: `código`, **negrito**, *itálico*, [texto](url).
const renderInline = (text:string, keyBase:string) => {
    const parts:any[] = []
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g
    let last = 0, m:any, i = 0
    while((m = regex.exec(text)) !== null){
        if(m.index > last) parts.push(text.slice(last, m.index))
        const tok = m[0]
        if(tok.startsWith("`"))          parts.push(<code key={`${keyBase}-${i++}`}>{tok.slice(1, -1)}</code>)
        else if(tok.startsWith("**"))    parts.push(<strong key={`${keyBase}-${i++}`}>{tok.slice(2, -2)}</strong>)
        else if(tok.startsWith("*"))     parts.push(<em key={`${keyBase}-${i++}`}>{tok.slice(1, -1)}</em>)
        else { const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok); if(mm) parts.push(<a key={`${keyBase}-${i++}`} href={mm[2]} target="_blank" rel="noreferrer">{mm[1]}</a>) }
        last = m.index + tok.length
    }
    if(last < text.length) parts.push(text.slice(last))
    return parts
}

const isHeading  = (l:string) => /^#{1,6}\s/.test(l)
const isBullet   = (l:string) => /^\s*[-*+]\s+/.test(l)
const isOrdered  = (l:string) => /^\s*\d+[.)]\s+/.test(l)
const isQuote    = (l:string) => /^\s*>\s?/.test(l)
const isHr       = (l:string) => /^\s*([-*_])\1{2,}\s*$/.test(l)
const isTableRow = (l:string) => l.indexOf("|") > -1
const isTableSep = (l:string) => isTableRow(l) && /-/.test(l) && /^[\s|:-]+$/.test(l.trim())
const splitCells = (l:string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())

// Renderizador markdown-lite, sem dependência externa. Suporta títulos, listas
// (ordenadas e não), tabelas (GFM), citações, código, hr, negrito/itálico, links.
const Markdown = ({ text }:any) => {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n")
    const blocks:any[] = []
    let i = 0, key = 0

    while(i < lines.length){
        const line = lines[i]

        if(line.startsWith("```")){
            const buf:string[] = []
            i++
            while(i < lines.length && !lines[i].startsWith("```")){ buf.push(lines[i]); i++ }
            i++
            blocks.push(<pre key={key++}><code>{buf.join("\n")}</code></pre>)
            continue
        }
        if(isHr(line)){ blocks.push(<hr key={key++} />); i++; continue }

        const h = /^(#{1,6})\s+(.*)$/.exec(line)
        if(h){
            const Tag:any = `h${h[1].length}`
            blocks.push(<Tag key={key++}>{renderInline(h[2], "h" + key)}</Tag>)
            i++; continue
        }

        if(isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])){
            const header = splitCells(line)
            i += 2
            const rows:string[][] = []
            while(i < lines.length && isTableRow(lines[i]) && lines[i].trim() !== "" && !isTableSep(lines[i])){ rows.push(splitCells(lines[i])); i++ }
            blocks.push(
                <table key={key++}>
                    <thead><tr>{ header.map((c, ci) => <th key={ci}>{renderInline(c, `th${key}-${ci}`)}</th>) }</tr></thead>
                    <tbody>{ rows.map((r, ri) => <tr key={ri}>{ header.map((_, ci) => <td key={ci}>{renderInline(r[ci] || "", `td${key}-${ri}-${ci}`)}</td>) }</tr>) }</tbody>
                </table>)
            continue
        }

        if(isQuote(line)){
            const buf:string[] = []
            while(i < lines.length && isQuote(lines[i])){ buf.push(lines[i].replace(/^\s*>\s?/, "")); i++ }
            blocks.push(<blockquote key={key++}>{ buf.join("\n").split(/\n{2,}/).map((para, pi) => <p key={pi}>{renderInline(para.replace(/\n/g, " "), `q${key}-${pi}`)}</p>) }</blockquote>)
            continue
        }

        if(isBullet(line) || isOrdered(line)){
            const ordered = isOrdered(line)
            const items:any[] = []
            while(i < lines.length && (ordered ? isOrdered(lines[i]) : isBullet(lines[i]))){
                const content = lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, "")
                items.push(<li key={items.length}>{renderInline(content, "li" + i)}</li>); i++
            }
            blocks.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>)
            continue
        }

        if(line.trim() === ""){ i++; continue }

        const buf:string[] = []
        while(i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("```") && !isHeading(lines[i]) && !isBullet(lines[i]) && !isOrdered(lines[i]) && !isQuote(lines[i]) && !isHr(lines[i]) && !isTableRow(lines[i])){
            buf.push(lines[i]); i++
        }
        if(buf.length) blocks.push(<p key={key++}>{renderInline(buf.join(" "), "p" + key)}</p>)
        else if(i < lines.length && lines[i].trim() !== ""){ blocks.push(<p key={key++}>{renderInline(lines[i], "pp" + key)}</p>); i++ }
    }

    return <Body>{blocks}</Body>
}

export default Markdown
