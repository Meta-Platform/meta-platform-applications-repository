import * as React from "react"
import { useRef, useState, useEffect } from "react"

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

const LINE_H = 20   // px — casado com line-height do FONT (para alinhar gutter/banda)
const PAD_Y  = 12

const FONT:any = {
    margin: 0,
    padding: `${PAD_Y}px 0`,
    paddingLeft: 14,
    fontFamily: 'var(--mp-font-code, "JetBrains Mono", "Menlo", "Monaco", "Consolas", monospace)',
    fontSize: "13px",
    lineHeight: `${LINE_H}px`,
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

// Editor de código com highlight, gutter (line numbers) e realce da linha atual.
// Técnica de overlay: um <pre> colorido atrás de um <textarea> transparente (o
// textarea recebe input/caret; o pre mostra as cores). O gutter e a banda de linha
// ativa acompanham o scroll do textarea.
const CodeEditor = ({ value, onChange }:CodeEditorProps) => {

    const code = value == null ? "" : String(value)   // blinda contra value undefined

    const preRef    = useRef<HTMLPreElement>(null)
    const taRef     = useRef<HTMLTextAreaElement>(null)
    const gutterRef = useRef<HTMLDivElement>(null)
    const bandRef   = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const vpRef     = useRef<HTMLDivElement>(null)
    const [activeLine, setActiveLine] = useState(1)
    const activeLineRef = useRef(1)
    activeLineRef.current = activeLine

    const lineCount = (code.match(/\n/g) || []).length + 1

    const positionBand = () => {
        const ta = taRef.current, band = bandRef.current
        if(ta && band) band.style.transform = `translateY(${PAD_Y + (activeLineRef.current - 1) * LINE_H - ta.scrollTop}px)`
    }

    const syncScroll = () => {
        const ta = taRef.current, pre = preRef.current, gut = gutterRef.current
        if(!ta) return
        if(pre){ pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft }
        if(gut){ gut.scrollTop = ta.scrollTop }
        positionBand()
        updateViewport()
    }

    // ---- Minimap (overview em canvas + indicador de viewport) ----
    const mLineH = () => { const cv = canvasRef.current; if(!cv) return 3; const n = (code.match(/\n/g) || []).length + 1; return Math.min(4, cv.clientHeight / n) }

    const drawMinimap = () => {
        const cv = canvasRef.current; if(!cv) return
        const w = cv.width = cv.clientWidth || 60, h = cv.height = cv.clientHeight || 300
        const ctx = cv.getContext("2d"); if(!ctx) return
        ctx.clearRect(0, 0, w, h)
        const lines = code.split("\n"), lh = mLineH()
        ctx.fillStyle = "rgba(150,168,200,.5)"
        for(let i = 0; i < lines.length; i++){
            const ln = lines[i].replace(/\s+$/, "")
            const indent = (ln.match(/^\s*/) || [""])[0].length
            const len = Math.min(ln.length, 90)
            if(len > indent) ctx.fillRect(2 + indent * 0.7, i * lh, (len - indent) * 0.7, Math.max(1, lh - 0.6))
        }
    }

    const updateViewport = () => {
        const ta = taRef.current, vp = vpRef.current
        if(!ta || !vp) return
        const lh = mLineH()
        vp.style.top = `${(ta.scrollTop / LINE_H) * lh}px`
        vp.style.height = `${Math.max(14, (ta.clientHeight / LINE_H) * lh)}px`
    }

    useEffect(() => { drawMinimap(); updateViewport() }, [code])
    useEffect(() => {
        const on = () => { drawMinimap(); updateViewport() }
        window.addEventListener("resize", on)
        const id = setTimeout(on, 50)   // após layout inicial
        return () => { window.removeEventListener("resize", on); clearTimeout(id) }
    }, [])

    const onMinimapClick = (e:React.MouseEvent) => {
        const cv = canvasRef.current, ta = taRef.current
        if(!cv || !ta) return
        const y = e.clientY - cv.getBoundingClientRect().top
        const line = y / mLineH()
        ta.scrollTop = Math.max(0, line * LINE_H - ta.clientHeight / 2)
        syncScroll()
    }

    const updateCaret = () => {
        const ta = taRef.current
        if(!ta) return
        const line = code.substring(0, ta.selectionStart).split("\n").length
        setActiveLine(line)
        activeLineRef.current = line
        positionBand()
    }

    const handleKeyDown = (e:React.KeyboardEvent<HTMLTextAreaElement>) => {
        if(e.key === "Tab"){
            e.preventDefault()
            const target = e.target as HTMLTextAreaElement
            const start = target.selectionStart, end = target.selectionEnd
            onChange(code.substring(0, start) + "    " + code.substring(end))
            requestAnimationFrame(() => { target.selectionStart = target.selectionEnd = start + 4 })
        }
    }

    // Números de linha (com a linha ativa destacada).
    const gutterInner:any[] = []
    for(let i = 1; i <= lineCount; i++)
        gutterInner.push(<div key={i} style={{
            height: LINE_H, textAlign: "right", paddingRight: 8,
            color: i === activeLine ? "var(--color-editor-text, #d9e2f1)" : "var(--color-editor-muted, #72809a)",
            fontWeight: i === activeLine ? 700 : 400
        }}>{i}</div>)

    return <div style={{
        position:"relative", flex:"1 1 auto", minHeight:0, display:"flex", overflow:"hidden",
        border:"2px solid var(--color-border-strong, #25231f)", borderRadius:"var(--mp-radius-md, 6px)",
        background:"var(--color-editor-bg, #0D1117)", boxShadow:"var(--shadow-window, none)"
    }}>
        {/* Gutter / line numbers */}
        <div ref={gutterRef} className="wb-scroll" style={{
            ...FONT, paddingLeft: 6, width: 48, flexShrink: 0, overflow: "hidden",
            background: "var(--color-editor-gutter, #0a0f1e)",
            borderRight: "1px solid var(--color-editor-line, #172035)", userSelect: "none"
        }}>
            <div>{gutterInner}</div>
        </div>

        {/* Área de código: banda da linha ativa + pre (cores) + textarea (input) */}
        <div style={{position:"relative", flex:1, minWidth:0, overflow:"hidden"}}>
            <div ref={bandRef} aria-hidden="true" style={{
                position:"absolute", left:0, right:0, top:0, height:LINE_H,
                background:"var(--color-editor-line, rgba(23,32,53,.55))", pointerEvents:"none",
                transform:`translateY(${PAD_Y}px)`
            }} />
            <pre ref={preRef} aria-hidden="true" className="wb-scroll" style={{
                ...FONT, position:"absolute", inset:0, overflow:"auto",
                color:"var(--color-editor-text, #c9d1d9)", pointerEvents:"none"
            }} dangerouslySetInnerHTML={{ __html: highlight(code) + "\n" }} />
            <textarea
                ref={taRef}
                className="code-editor wb-scroll"
                spellCheck={false}
                value={code}
                onChange={(e) => { onChange(e.target.value); requestAnimationFrame(updateCaret) }}
                onScroll={syncScroll}
                onKeyDown={handleKeyDown}
                onKeyUp={updateCaret}
                onClick={updateCaret}
                style={{
                    ...FONT, position:"absolute", inset:0, width:"100%", height:"100%", overflow:"auto",
                    background:"transparent", color:"transparent", WebkitTextFillColor:"transparent",
                    caretColor:"var(--color-accent, #14D6C8)", border:"none", outline:"none", resize:"none"
                }} />
        </div>

        {/* Minimap: overview do arquivo (canvas) + indicador de viewport, click-to-scroll */}
        <div onClick={onMinimapClick} title="Minimap"
            style={{position:"relative", width:62, flexShrink:0, cursor:"pointer",
                borderLeft:"1px solid var(--color-editor-line, #172035)", background:"var(--color-editor-gutter, #0a0f1e)"}}>
            <canvas ref={canvasRef} style={{width:"100%", height:"100%", display:"block"}} />
            <div ref={vpRef} style={{position:"absolute", left:0, right:0, top:0,
                background:"rgba(120,150,200,.16)", borderTop:"1px solid rgba(150,180,220,.35)",
                borderBottom:"1px solid rgba(150,180,220,.35)", pointerEvents:"none"}} />
        </div>
    </div>
}

export default CodeEditor
