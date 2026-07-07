import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Icon } from "semantic-ui-react"

export type PaletteItem = {
    id: string
    label: string
    hint?: string
    icon?: string
    color?: string
    action: () => void
}

// Filtro fuzzy simples: todos os caracteres da query aparecem em ordem no alvo.
const fuzzy = (q:string, s:string) => {
    if(!q) return true
    q = q.toLowerCase(); s = s.toLowerCase()
    let i = 0
    for(const c of s){ if(c === q[i]) i++; if(i === q.length) return true }
    return i === q.length
}

// Command palette estilo IDE (Ctrl+P / Ctrl+Shift+P): input + lista filtrável com
// navegação por teclado (↑/↓/Enter/Esc).
const CommandPalette = ({ open, placeholder, items, onClose }:any) => {
    const [q, setQ] = useState("")
    const [sel, setSel] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if(open){ setQ(""); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 0) }
    }, [open])

    if(!open) return null

    const filtered:PaletteItem[] = (items || []).filter((it:PaletteItem) => fuzzy(q, `${it.label} ${it.hint || ""}`))
    const clamped = Math.max(0, Math.min(sel, filtered.length - 1))

    const run = (it:PaletteItem) => { onClose(); it && it.action() }

    const onKey = (e:React.KeyboardEvent) => {
        if(e.key === "ArrowDown"){ e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)) }
        else if(e.key === "ArrowUp"){ e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
        else if(e.key === "Enter"){ e.preventDefault(); run(filtered[clamped]) }
        else if(e.key === "Escape"){ e.preventDefault(); onClose() }
    }

    return <div onMouseDown={onClose} style={{
        position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.28)",
        display:"flex", justifyContent:"center", alignItems:"flex-start", paddingTop:"12vh"
    }}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{
            width:"min(620px, 92vw)", background:"var(--color-surface, #fff8e8)",
            border:"2px solid var(--color-border-strong, #25231f)", borderRadius:8,
            boxShadow:"var(--shadow-window, 3px 3px 0 rgba(35,32,24,.82))", overflow:"hidden",
            fontFamily:"var(--font-ui)"
        }}>
            <div style={{display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderBottom:"1px solid var(--mp-line-faint)"}}>
                <Icon name="search" style={{margin:0, opacity:0.55}} />
                <input ref={inputRef} value={q} placeholder={placeholder || "Buscar…"}
                    onChange={(e) => { setQ(e.target.value); setSel(0) }} onKeyDown={onKey}
                    style={{flex:1, border:"none", outline:"none", background:"transparent", fontSize:14, color:"var(--color-text)"}} />
                <span style={{fontSize:11, opacity:0.4}}>Esc</span>
            </div>
            <div ref={listRef} className="wb-scroll" style={{maxHeight:"46vh", overflowY:"auto", padding:"4px 0"}}>
                {
                    filtered.length === 0
                    ? <div style={{padding:"14px 16px", opacity:0.55, fontSize:13}}>Nenhum resultado.</div>
                    : filtered.map((it, i) =>
                        <div key={it.id} onMouseEnter={() => setSel(i)} onClick={() => run(it)}
                            style={{
                                display:"flex", alignItems:"center", gap:10, padding:"7px 14px", cursor:"pointer",
                                background: i === clamped ? "var(--color-accent-soft, rgba(20,214,200,.16))" : "transparent",
                                boxShadow: i === clamped ? "inset 3px 0 0 var(--color-accent, #14D6C8)" : "none"
                            }}>
                            <Icon name={(it.icon as any) || "circle outline"} style={{margin:0, color: it.color || "var(--color-text-muted)"}} />
                            <span style={{flex:1, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{it.label}</span>
                            { it.hint && <span style={{fontSize:11, opacity:0.5, whiteSpace:"nowrap"}}>{it.hint}</span> }
                        </div>)
                }
            </div>
        </div>
    </div>
}

export default CommandPalette
