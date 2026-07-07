import * as React from "react"
import { Header, Icon, List, Button } from "semantic-ui-react"

const isScalar = (v:any) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean"

const codeStyle:any = { background:"rgba(128,128,128,0.16)", padding:"1px 6px", borderRadius:3, fontFamily:"monospace", fontSize:"0.86em", wordBreak:"break-all" }

// Nó read-only recursivo: escalares viram "chave: valor"; arrays/objetos indentam.
const Node = ({ k, v }:any) => {
    if(isScalar(v))
        return <List.Item>
            <List.Content>
                <span style={{fontWeight:600, marginRight:6}}>{k}:</span>
                { v == null || v === "" ? <span style={{opacity:0.45}}>—</span> : <code style={codeStyle}>{String(v)}</code> }
            </List.Content>
        </List.Item>

    if(Array.isArray(v))
        return <List.Item>
            <List.Content>
                <List.Header>{k} <span style={{opacity:0.5, fontWeight:400}}>({v.length})</span></List.Header>
                <List.List>
                    { v.map((item:any, i:number) =>
                        isScalar(item)
                        ? <List.Item key={i}><code style={codeStyle}>{String(item)}</code></List.Item>
                        : <Node key={i} k={`#${i + 1}`} v={item} />) }
                </List.List>
            </List.Content>
        </List.Item>

    // objeto
    const keys = Object.keys(v || {})
    return <List.Item>
        <List.Content>
            <List.Header>{k}</List.Header>
            <List.List>
                { keys.length === 0
                    ? <List.Item><span style={{opacity:0.45}}>vazio</span></List.Item>
                    : keys.map((kk) => <Node key={kk} k={kk} v={v[kk]} />) }
            </List.List>
        </List.Content>
    </List.Item>
}

// Detalhe de um item selecionado na árvore (boot, serviço, endpoint, comando…).
// Substitui as abas no painel de info; "Voltar" retorna às abas.
const DetailView = ({ title, icon, data, onBack }:any) =>
    <div>
        <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:10}}>
            <Button size="mini" basic icon="arrow left" content="Voltar" onClick={onBack} />
            <Header as="h4" style={{margin:0}}><Icon name={icon || "info circle"} />{title}</Header>
        </div>
        <List>
            {
                data && typeof data === "object" && !Array.isArray(data)
                ? Object.keys(data).map((k) => <Node key={k} k={k} v={data[k]} />)
                : <Node k="valor" v={data} />
            }
        </List>
    </div>

export default DetailView
