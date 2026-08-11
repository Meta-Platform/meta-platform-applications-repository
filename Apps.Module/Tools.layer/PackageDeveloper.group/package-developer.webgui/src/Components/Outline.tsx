import * as React from "react"
import { Icon, TreeRow } from "@i-components"

// Símbolos de um arquivo de código (regex leve, sem parser).
const codeSymbols = (src:string) => {
    const out:any[] = []
    const push = (icon:string, color:string, name:string, line:number) => out.push({ icon, color, name, line })
    const lines = src.split("\n")
    lines.forEach((ln, i) => {
        let m:any
        if((m = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/.exec(ln))) push("code", "blue", m[1], i + 1)
        else if((m = /^\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/.exec(ln))) push("cube", "purple", m[1], i + 1)
        else if((m = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/.exec(ln))) push("dot circle outline", "grey", m[1], i + 1)
        else if((m = /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(?.*=>/.exec(ln))) push("code", "teal", m[1], i + 1)
    })
    return out
}

// Estrutura (chaves) de um objeto JSON — 2 níveis.
const JsonKeys = ({ obj, depth }:any) => {
    if(obj == null || typeof obj !== "object") return null
    const entries = Array.isArray(obj) ? obj.map((v:any, i:number) => [String(i), v]) : Object.keys(obj).map((k) => [k, obj[k]])
    return <>
        {
            entries.map(([k, v]:any, i:number) => {
                const isObj = v && typeof v === "object"
                const icon = Array.isArray(v) ? "list" : isObj ? "folder outline" : "minus"
                return <React.Fragment key={i}>
                    <TreeRow
                        depth={depth}
                        icon={icon}
                        label={
                            <span style={{fontWeight: isObj ? 600 : 400, fontSize:"0.92em"}}>
                                {k}{ Array.isArray(v) && <span style={{opacity:.5}}> [{v.length}]</span> }
                                { !isObj && <span style={{opacity:.5, marginLeft:6, fontWeight:400}}>{String(v).slice(0, 24)}</span> }
                            </span>
                        } />
                    { isObj && depth < 1 && <JsonKeys obj={v} depth={depth + 1} /> }
                </React.Fragment>
            })
        }
    </>
}

// Painel Outline: símbolos do arquivo de código OU chaves do JSON ativo.
const Outline = ({ tab, onGoto }:any) => {
    if(!tab) return <div style={{opacity:.55, fontSize:13, padding:"6px 4px"}}>Nenhum arquivo aberto.</div>

    const content = tab.content || ""
    const isJson = tab.kind === "component" || /\.json$/i.test(tab.filePath || "")

    if(isJson){
        let obj:any
        try { obj = JSON.parse(content) } catch(e) { return <div style={{opacity:.6, fontSize:13, padding:"6px 4px"}}><Icon name="warning circle" color="red" />JSON inválido</div> }
        return <div><JsonKeys obj={obj} depth={0} /></div>
    }

    const syms = codeSymbols(content)
    if(syms.length === 0) return <div style={{opacity:.55, fontSize:13, padding:"6px 4px"}}>Sem símbolos detectados.</div>
    return <div>
        { syms.map((s, i) =>
            <div key={i} title={`linha ${s.line}`}>
                <TreeRow
                    icon={s.icon}
                    label={<span style={{fontSize:"0.92em", fontWeight:500}}>{s.name}</span>}
                    meta={`:${s.line}`}
                    onSelect={() => onGoto && onGoto(s.line)} />
            </div>) }
    </div>
}

export default Outline
