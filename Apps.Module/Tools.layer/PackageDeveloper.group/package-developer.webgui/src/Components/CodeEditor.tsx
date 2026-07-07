import * as React from "react"
import { useRef } from "react"

const escapeHtml = (s:string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Tokenizer leve (sem dependência) para JS/TS/JSON: comentários, strings, números,
// palavras-chave e literais. Ordem importa (comentários/strings primeiro).
const RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d._]*(?:\.\d+)?\b)|(\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|import|from|export|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|yield|delete|void|require|module)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)/g

const COLOR = {
    comment: "#6a9955",
    string:  "#ce9178",
    number:  "#b5cea8",
    keyword: "#569cd6",
    literal: "#569cd6"
}

const highlight = (code:string) => {
    let out = "", last = 0, m:any
    RE.lastIndex = 0
    while((m = RE.exec(code)) !== null){
        out += escapeHtml(code.slice(last, m.index))
        const color = m[1] ? COLOR.comment : m[2] ? COLOR.string : m[3] ? COLOR.number : m[4] ? COLOR.keyword : COLOR.literal
        out += `<span style="color:${color}">${escapeHtml(m[0])}</span>`
        last = m.index + m[0].length
    }
    out += escapeHtml(code.slice(last))
    return out
}

const FONT:any = {
    margin: 0,
    padding: 12,
    fontFamily: 'var(--mp-font-code, "Menlo", "Monaco", "Consolas", monospace)',
    fontSize: "13px",
    lineHeight: "1.55",
    tabSize: 4,
    whiteSpace: "pre",
    wordWrap: "normal",
    letterSpacing: "normal",
    boxSizing: "border-box"
}

type CodeEditorProps = {
    value    : string
    language : string
    onChange : (value:string) => void
}

// Editor de código com highlight: um <pre> colorido atrás de um <textarea>
// transparente (o textarea recebe input/caret; o pre mostra as cores).
const CodeEditor = ({ value, onChange }:CodeEditorProps) => {

    const preRef = useRef<HTMLPreElement>(null)
    const taRef  = useRef<HTMLTextAreaElement>(null)

    const syncScroll = () => {
        const ta = taRef.current, pre = preRef.current
        if(ta && pre){ pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft }
    }

    const handleKeyDown = (e:React.KeyboardEvent<HTMLTextAreaElement>) => {
        if(e.key === "Tab"){
            e.preventDefault()
            const target = e.target as HTMLTextAreaElement
            const start = target.selectionStart, end = target.selectionEnd
            onChange(value.substring(0, start) + "    " + value.substring(end))
            requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 4 })
        }
    }

    return <div style={{
        position:"relative", flex:"1 1 auto", minHeight:0, overflow:"hidden",
        border:"1px solid var(--mp-code-border, #2A3645)", borderRadius:"var(--mp-radius-md, 6px)",
        background:"var(--mp-code-bg, #0D1117)"
    }}>
        <pre ref={preRef} aria-hidden="true" style={{
            ...FONT, position:"absolute", inset:0, overflow:"auto",
            color:"#c9d1d9", pointerEvents:"none"
        }} dangerouslySetInnerHTML={{ __html: highlight(value) + "\n" }} />
        <textarea
            ref={taRef}
            className="code-editor"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            style={{
                ...FONT, position:"absolute", inset:0, width:"100%", height:"100%", overflow:"auto",
                background:"transparent", color:"transparent", WebkitTextFillColor:"transparent",
                caretColor:"var(--mp-accent, #14D6C8)", border:"none", outline:"none", resize:"none"
            }} />
    </div>
}

export default CodeEditor
