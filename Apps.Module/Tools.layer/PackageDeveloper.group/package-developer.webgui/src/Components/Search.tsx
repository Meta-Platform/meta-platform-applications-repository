import * as React from "react"
import { useState, useRef } from "react"
import { Icon, Loader } from "semantic-ui-react"

import { pkgContext } from "../Utils/pkgContext"

// Realça a query no trecho.
const Highlight = ({ text, q }:any) => {
    const i = text.toLowerCase().indexOf(q.toLowerCase())
    if(i < 0 || !q) return <>{text}</>
    return <>{text.slice(0, i)}<mark style={{background:"var(--color-warning, #d78a20)", color:"#1a1200", borderRadius:2}}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

// Busca real no workspace: chama o endpoint SearchFiles em cada pacote aberto e
// agrupa os resultados por arquivo (nome + linhas). Clique abre o arquivo.
const Search = ({ pkgs, searchFiles, onOpen }:any) => {
    const [q, setQ] = useState("")
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [ran, setRan] = useState(false)
    const [truncated, setTruncated] = useState(false)
    const seq = useRef(0)

    const run = async () => {
        const query = q.trim()
        setRan(true)
        if(!query){ setResults([]); return }
        const my = ++seq.current
        setLoading(true); setTruncated(false)
        const all:any[] = []
        let trunc = false
        for(const pk of (pkgs || [])){
            try {
                const { data } = await searchFiles({ workspace: pk.workspace, packageName: pk.name, ext: pk.ext, query })
                if(data && data.truncated) trunc = true
                ;(data && data.results || []).forEach((r:any) => all.push({ pkg: pk, ...r }))
            } catch(e) {}
            if(my !== seq.current) return   // busca mais nova em andamento
        }
        if(my !== seq.current) return
        setResults(all); setTruncated(trunc); setLoading(false)
    }

    const totalMatches = results.reduce((n, r) => n + (r.matches ? r.matches.length : 0) + (r.nameMatch ? 1 : 0), 0)

    return <div>
        <div style={{display:"flex", alignItems:"center", gap:6, padding:"4px 6px", marginBottom:8,
            border:"1.5px solid var(--mp-border-default, var(--mp-line-soft))", borderRadius:4, background:"var(--color-surface)"}}>
            <Icon name="search" style={{margin:0, opacity:0.5}} />
            <input value={q} autoFocus placeholder="Buscar no workspace…"
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if(e.key === "Enter") run() }}
                style={{flex:1, border:"none", outline:"none", background:"transparent", fontSize:13, color:"var(--color-text)"}} />
            { loading ? <Loader active inline size="tiny" /> : <Icon name="arrow right" link title="Buscar (Enter)" style={{margin:0, opacity:0.6}} onClick={run} /> }
        </div>

        {
            ran && !loading &&
            <div style={{fontSize:11, opacity:0.6, margin:"0 0 8px 4px"}}>
                { results.length === 0 ? "Nenhum resultado." : `${totalMatches} ocorrência(s) em ${results.length} arquivo(s)${truncated ? " (parcial)" : ""}` }
            </div>
        }

        {
            results.map((r:any, i:number) => { const c = pkgContext(r.pkg)
                return <div key={i} style={{marginBottom:8}}>
                    <div onClick={() => onOpen(r.pkg, r.path, r.matches && r.matches[0] && r.matches[0].line)} title={`${r.pkg.name}.${r.pkg.ext}${r.path}`}
                        style={{display:"flex", alignItems:"center", gap:6, padding:"3px 4px", cursor:"pointer", fontSize:12.5, fontWeight:600}}>
                        <span style={{width:7, height:7, borderRadius:2, background:c.color, flexShrink:0}} />
                        <span style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{r.filename}</span>
                        { r.nameMatch && <span style={{fontSize:9.5, opacity:0.6, border:"1px solid var(--mp-line-faint)", borderRadius:3, padding:"0 4px"}}>nome</span> }
                        <span style={{flex:1, minWidth:0, fontSize:10.5, opacity:0.45, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", direction:"rtl", textAlign:"left"}}>{r.path}</span>
                    </div>
                    {
                        (r.matches || []).map((m:any, j:number) =>
                            <div key={j} onClick={() => onOpen(r.pkg, r.path, m.line)} title={`linha ${m.line}`}
                                style={{display:"flex", gap:8, padding:"1px 4px 1px 18px", cursor:"pointer", fontFamily:"var(--font-mono)", fontSize:11.5}}
                                onMouseEnter={(e:any) => e.currentTarget.style.background = "rgba(127,127,127,.1)"}
                                onMouseLeave={(e:any) => e.currentTarget.style.background = "transparent"}>
                                <span style={{opacity:0.4, minWidth:26, textAlign:"right"}}>{m.line}</span>
                                <span style={{flex:1, minWidth:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}><Highlight text={m.text} q={q.trim()} /></span>
                            </div>)
                    }
                </div>
            })
        }
    </div>
}

export default Search
