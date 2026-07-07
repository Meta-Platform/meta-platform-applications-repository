import * as React from "react"
import { List, Icon } from "semantic-ui-react"

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
    return <List.List style={depth === 0 ? {margin:0} : undefined}>
        {
            entries.map(([k, v]:any, i:number) => {
                const isObj = v && typeof v === "object"
                const icon = Array.isArray(v) ? "list" : isObj ? "folder outline" : "minus"
                return <List.Item key={i}>
                    <List.Icon name={icon as any} color={isObj ? "yellow" : "grey"} />
                    <List.Content>
                        <List.Header style={{fontWeight: isObj ? 600 : 400, fontSize:"0.92em"}}>
                            {k}{ Array.isArray(v) && <span style={{opacity:.5}}> [{v.length}]</span> }
                            { !isObj && <span style={{opacity:.5, marginLeft:6, fontWeight:400}}>{String(v).slice(0, 24)}</span> }
                        </List.Header>
                        { isObj && depth < 1 && <JsonKeys obj={v} depth={depth + 1} /> }
                    </List.Content>
                </List.Item>
            })
        }
    </List.List>
}

// Painel Outline: símbolos do arquivo de código OU chaves do JSON ativo.
const Outline = ({ tab, onGoto }:any) => {
    if(!tab) return <div style={{opacity:.55, fontSize:13, padding:"6px 4px"}}>Nenhum arquivo aberto.</div>

    const content = tab.content || ""
    const isJson = tab.kind === "component" || /\.json$/i.test(tab.filePath || "")

    if(isJson){
        let obj:any
        try { obj = JSON.parse(content) } catch(e) { return <div style={{opacity:.6, fontSize:13, padding:"6px 4px"}}><Icon name="warning circle" color="red" />JSON inválido</div> }
        return <List size="small" style={{margin:0}}><JsonKeys obj={obj} depth={0} /></List>
    }

    const syms = codeSymbols(content)
    if(syms.length === 0) return <div style={{opacity:.55, fontSize:13, padding:"6px 4px"}}>Sem símbolos detectados.</div>
    return <List size="small" style={{margin:0}}>
        { syms.map((s, i) =>
            <List.Item key={i} style={{cursor:"pointer"}} onClick={() => onGoto && onGoto(s.line)} title={`linha ${s.line}`}>
                <List.Icon name={s.icon} color={s.color} />
                <List.Content>
                    <List.Header style={{fontSize:"0.92em", fontWeight:500}}>
                        {s.name}<span style={{opacity:.4, marginLeft:6, fontSize:"0.85em"}}>:{s.line}</span>
                    </List.Header>
                </List.Content>
            </List.Item>) }
    </List>
}

export default Outline
