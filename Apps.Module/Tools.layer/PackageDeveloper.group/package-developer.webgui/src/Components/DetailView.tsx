import * as React from "react"
import { Icon, Button } from "semantic-ui-react"

// Detalhe SOMENTE-LEITURA de um item selecionado na árvore (boot, serviço,
// endpoint, comando…). Usa as dicas semânticas do `detail` (kind, fields) para
// renderizar com hierarquia: params viram chips, registros viram cartões, e as
// referências @/ @@/ e placeholders {{…}} ganham cor própria. "Voltar" retorna
// às abas do painel.

// ---- Tokens (fallback embutido p/ funcionar fora do tema) ----
const T = {
    ink:      "var(--mp-ink, #171713)",
    muted:    "var(--mp-muted, #73766D)",
    muted2:   "var(--mp-muted-2, #9A9D92)",
    line:     "var(--mp-line-faint, #D7CFBA)",
    lineSoft: "var(--mp-line-soft, #B8B3A3)",
    surface:  "var(--mp-surface, #FFF9E8)",
    surface2: "var(--mp-surface-2, #F8F1DD)",
    codeBg:   "var(--mp-code-bg, rgba(128,128,128,0.12))",
    refBg:    "var(--mp-accent-blue-tint, #E2ECF8)",
    refFg:    "var(--mp-accent-blue, #2D74C4)",
    tmplBg:   "var(--mp-accent-orange-tint, #F6E6D5)",
    tmplFg:   "var(--mp-accent-orange, #C96A1E)",
    mono:     "var(--mp-font-mono, monospace)",
    rSm:      "var(--mp-radius-sm, 4px)",
    rMd:      "var(--mp-radius-md, 8px)"
}

const isScalar = (v:any) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"
const isEmptyObj = (v:any) => v && typeof v === "object" && Object.keys(v).length === 0
const isRef = (s:any) => typeof s === "string" && /^@@?\//.test(s.trim())
const isTemplate = (s:any) => typeof s === "string" && /\{\{[^}]*\}\}/.test(s)

// Rótulo identificador de um registro (namespace, url, comando…).
const IDENTITY_KEYS = ["namespace", "dependency", "url", "command", "commandName", "executableName", "title", "name"]
const identityOf = (rec:any):string | undefined => {
    if(!rec || typeof rec !== "object") return undefined
    for(const k of IDENTITY_KEYS) if(rec[k]) return String(rec[k])
    return undefined
}

// ---- Primitivas visuais ----

const chipBase:any = {
    display:"inline-block", padding:"1px 7px", borderRadius:T.rSm,
    fontFamily:T.mono, fontSize:"0.84em", wordBreak:"break-all", lineHeight:1.5
}
const styleFor = (s:string):any =>
    isRef(s)      ? { ...chipBase, background:T.refBg,  color:T.refFg,  fontWeight:600 } :
    isTemplate(s) ? { ...chipBase, background:T.tmplBg, color:T.tmplFg } :
                    { ...chipBase, background:T.codeBg, color:T.ink }

// Valor escalar → chip colorido (ou traço, se vazio).
const Value = ({ v }:any) => {
    if(v == null || v === "") return <span style={{color:T.muted2, fontStyle:"italic"}}>—</span>
    if(typeof v === "boolean") return <code style={styleFor("")}>{v ? "true" : "false"}</code>
    return <code style={styleFor(String(v))}>{String(v)}</code>
}

const keyStyle:any = { color:T.muted, fontWeight:600, fontSize:"0.86em", whiteSpace:"nowrap" }

// Grade chave → valor alinhada (params, bound-params e campos escalares).
const KVGrid = ({ entries }:any) =>
    <div style={{display:"grid", gridTemplateColumns:"max-content minmax(0,1fr)", gap:"5px 12px", alignItems:"baseline"}}>
        { entries.map(([k, v]:any) =>
            <React.Fragment key={k}>
                <span style={keyStyle}>{k}</span>
                <div style={{minWidth:0}}><NestedValue v={v} /></div>
            </React.Fragment>) }
    </div>

// Valor aninhado: escalar → chip; objeto → grade; array → chips/mini-cartões.
const NestedValue = ({ v }:any):any => {
    if(isScalar(v)) return <Value v={v} />
    if(isEmptyObj(v)) return <span style={{color:T.muted2, fontStyle:"italic"}}>vazio</span>
    if(Array.isArray(v)){
        if(v.length === 0) return <span style={{color:T.muted2, fontStyle:"italic"}}>vazio</span>
        if(v.every(isScalar))
            return <div style={{display:"flex", flexWrap:"wrap", gap:6}}>{ v.map((x:any, i:number) => <Value key={i} v={x} />) }</div>
        return <div style={{display:"flex", flexDirection:"column", gap:8}}>
            { v.map((x:any, i:number) => <MiniCard key={i} index={i} rec={x} />) }
        </div>
    }
    return <KVGrid entries={Object.entries(v)} />
}

// Rótulo de seção (params, bound-params…).
const SectionLabel = ({ children }:any) =>
    <div style={{fontSize:"0.68em", fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:T.muted2, marginBottom:5}}>{children}</div>

// Corpo de um registro: escalares numa grade; objetos/arrays como sub-seções.
const RecordBody = ({ rec, fields }:any) => {
    if(isScalar(rec)) return <Value v={rec} />
    const known = (fields || []).map((f:any) => f.key)
    const all = Object.keys(rec || {})
    const order = fields
        ? [...known.filter((k:string) => k in rec), ...all.filter((k:string) => !known.includes(k))]
        : all
    const scalars = order.filter((k:string) => isScalar(rec[k]))
    const groups  = order.filter((k:string) => !isScalar(rec[k]))
    return <div style={{display:"flex", flexDirection:"column", gap:12}}>
        { scalars.length > 0 &&
            <KVGrid entries={scalars.map((k:string) => [k, rec[k]])} /> }
        { groups.map((k:string) =>
            <div key={k}>
                <SectionLabel>{k}</SectionLabel>
                <div style={{borderLeft:`2px solid ${T.line}`, paddingLeft:10}}>
                    <NestedValue v={rec[k]} />
                </div>
            </div>) }
    </div>
}

// Cartão de um registro (item de lista): faixa-título + corpo.
const RecordCard = ({ title, index, rec, fields, icon }:any) =>
    <div style={{border:`1px solid ${T.line}`, borderRadius:T.rMd, background:T.surface, overflow:"hidden"}}>
        <div style={{display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surface2, borderBottom:`1px solid ${T.line}`}}>
            { index != null && <span style={{fontFamily:T.mono, fontSize:"0.72em", color:T.muted2, fontWeight:700}}>{String(index + 1).padStart(2, "0")}</span> }
            { icon && <Icon name={icon} style={{color:T.muted, margin:0}} /> }
            <span style={{fontFamily:T.mono, fontWeight:600, fontSize:"0.9em", color:T.ink, wordBreak:"break-all"}}>{title || "item"}</span>
        </div>
        <div style={{padding:"10px 12px"}}><RecordBody rec={rec} fields={fields} /></div>
    </div>

// Mini-cartão (registro dentro de um array aninhado, sem field-set conhecido).
const MiniCard = ({ index, rec }:any) => {
    const id = identityOf(rec)
    return <div style={{border:`1px dashed ${T.lineSoft}`, borderRadius:T.rSm, padding:"7px 9px", background:T.surface}}>
        { id && <div style={{fontFamily:T.mono, fontWeight:600, fontSize:"0.84em", color:T.ink, marginBottom:6, wordBreak:"break-all"}}>
            <span style={{color:T.muted2, marginRight:6}}>{String(index + 1).padStart(2, "0")}</span>{id}</div> }
        <RecordBody rec={rec} />
    </div>
}

// ---- Comandos (recursivo) ----
const CommandCard = ({ cmd, depth }:any) => {
    const kids = Array.isArray(cmd.children) ? cmd.children : []
    const title = cmd.command || cmd.commandName || cmd.namespace || "comando"
    const { children, ...own } = cmd || {}
    return <div style={{border:`1px solid ${T.line}`, borderRadius:T.rMd, background:T.surface, overflow:"hidden"}}>
        <div style={{display:"flex", alignItems:"center", gap:8, padding:"7px 10px", background:T.surface2, borderBottom:`1px solid ${T.line}`}}>
            <Icon name="terminal" style={{color:"var(--mp-accent-cyan, #00B7C2)", margin:0}} />
            <span style={{fontFamily:T.mono, fontWeight:600, fontSize:"0.9em", color:T.ink}}>{title}</span>
            { cmd.description && <span style={{fontSize:"0.8em", color:T.muted, marginLeft:"auto", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"55%"}}>{cmd.description}</span> }
        </div>
        <div style={{padding:"10px 12px", display:"flex", flexDirection:"column", gap:12}}>
            <RecordBody rec={own} />
            { kids.length > 0 &&
                <div>
                    <SectionLabel>subcomandos ({kids.length})</SectionLabel>
                    <div style={{display:"flex", flexDirection:"column", gap:8, borderLeft:`2px solid ${T.line}`, paddingLeft:10}}>
                        { kids.map((c:any, i:number) => <CommandCard key={i} cmd={c} depth={(depth || 0) + 1} />) }
                    </div>
                </div> }
        </div>
    </div>
}

// ---- Estado vazio ----
const Empty = ({ text }:any) =>
    <div style={{color:T.muted2, fontStyle:"italic", padding:"12px 2px"}}>{text || "sem conteúdo"}</div>

// ---- Corpo por tipo ----
const Body = ({ kind, data, fields }:any) => {
    // Lista de strings (ex.: Boot · Params) → chips.
    if(kind === "strings"){
        const list = Array.isArray(data) ? data : []
        if(!list.length) return <Empty text="nenhum parâmetro" />
        return <div style={{display:"flex", flexWrap:"wrap", gap:8}}>
            { list.map((s:any, i:number) => <code key={i} style={styleFor(String(s))}>{String(s)}</code>) }
        </div>
    }

    // Lista de registros → um cartão por item.
    if(kind === "list"){
        const list = Array.isArray(data) ? data : []
        if(!list.length) return <Empty text="lista vazia" />
        return <div style={{display:"flex", flexDirection:"column", gap:12}}>
            { list.map((rec:any, i:number) =>
                <RecordCard key={i} index={i} title={identityOf(rec)} rec={rec} fields={fields} />) }
        </div>
    }

    // Registro único → corpo direto (já é o item focado).
    if(kind === "record"){
        if(!data || isEmptyObj(data)) return <Empty />
        return <RecordBody rec={data} fields={fields} />
    }

    // Comandos (array na raiz "Comandos", ou objeto único num nó de comando).
    if(kind === "commands"){
        const list = Array.isArray(data) ? data : (data ? [data] : [])
        if(!list.length) return <Empty text="nenhum comando" />
        return <div style={{display:"flex", flexDirection:"column", gap:12}}>
            { list.map((c:any, i:number) => <CommandCard key={i} cmd={c} depth={0} />) }
        </div>
    }

    // Boot (overview) e fallback: objeto → seções por chave; escalar → valor.
    if(!data || (typeof data === "object" && Object.keys(data).length === 0)) return <Empty />
    if(isScalar(data)) return <Value v={data} />
    if(Array.isArray(data)) return <NestedValue v={data} />
    return <div style={{display:"flex", flexDirection:"column", gap:14}}>
        { Object.entries(data).map(([k, v]:any) =>
            <div key={k}>
                <SectionLabel>{k}{Array.isArray(v) ? ` (${v.length})` : ""}</SectionLabel>
                <NestedValue v={v} />
            </div>) }
    </div>
}

// Contagem para o cabeçalho (nº de itens, quando aplicável).
const countOf = (kind:string, data:any):number | undefined => {
    if(kind === "strings" || kind === "list") return Array.isArray(data) ? data.length : undefined
    if(kind === "commands") return Array.isArray(data) ? data.length : undefined
    return undefined
}

const DetailView = ({ detail, onBack }:any) => {
    if(!detail) return null
    const { title, icon, data, kind } = detail
    const count = countOf(kind, data)
    return <div>
        <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:12, paddingBottom:10, borderBottom:`1px solid ${T.line}`}}>
            <Button size="mini" basic icon="arrow left" content="Voltar" onClick={onBack} />
            <Icon name={icon || "info circle"} style={{margin:0, color:T.muted}} />
            <span style={{fontFamily:T.mono, fontWeight:700, fontSize:"1.02em", color:T.ink, wordBreak:"break-all"}}>{title}</span>
            { count != null &&
                <span style={{marginLeft:"auto", fontSize:"0.72em", fontWeight:700, color:T.muted2,
                    background:T.surface2, border:`1px solid ${T.line}`, borderRadius:999, padding:"1px 9px"}}>{count}</span> }
        </div>
        <Body kind={kind} data={data} fields={detail.fields} />
    </div>
}

export default DetailView
