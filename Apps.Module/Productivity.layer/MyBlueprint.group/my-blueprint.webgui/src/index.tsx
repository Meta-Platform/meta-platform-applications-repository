import * as React from "react"
import ReactDOM from "react-dom/client"
import "./styles.css"

type Item = { id:string, type:string, title:string, body:string, status:string, priority:string, tags:string[] }
const api = async (path:string, options:any = {}) => {
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options })
  const data = await response.json()
  if(!response.ok) throw new Error(data.message || data.error || "A operação falhou")
  return data
}
const statuses = ["inbox", "backlog", "planned", "done"]
const label:any = { inbox:"Inbox", backlog:"Backlog", planned:"Planejado", done:"Concluído" }

const App = () => {
  const [items, setItems] = React.useState<Item[]>([]), [query, setQuery] = React.useState(""), [draft, setDraft] = React.useState(""), [chat, setChat] = React.useState(""), [answer, setAnswer] = React.useState(""), [settings, setSettings] = React.useState(false), [apiKey, setApiKey] = React.useState(""), [model, setModel] = React.useState("gpt-4.1-mini"), [notice, setNotice] = React.useState("")
  const load = async () => { try { setItems(await api(`/blueprint/items${query ? `?query=${encodeURIComponent(query)}` : ""}`)) } catch(e:any) { setNotice(e.message) } }
  React.useEffect(() => { load() }, [query])
  const capture = async () => { if(!draft.trim()) return; await api("/blueprint/items", { method:"POST", body:JSON.stringify({ title:draft, body:draft, type:"idea" }) }); setDraft(""); await load() }
  const move = async (item:Item, status:string) => { await api(`/blueprint/items/${item.id}`, { method:"PATCH", body:JSON.stringify({ status }) }); await load() }
  const ask = async () => { if(!chat.trim()) return; try { const result = await api("/blueprint/chat", { method:"POST", body:JSON.stringify({ message:chat, items }) }); setAnswer(result.message); setChat("") } catch(e:any) { setAnswer(e.message) } }
  const save = async () => { try { await api("/blueprint/settings", { method:"POST", body:JSON.stringify({ apiKey, model }) }); setApiKey(""); setSettings(false); setNotice("Configuração salva localmente.") } catch(e:any) { setNotice(e.message) } }
  return <main>
    <header><div><small>PRODUCTIVITY WORKSPACE</small><h1>My Blueprint</h1></div><div className="header-actions"><button onClick={() => setSettings(true)}>Configurações</button><span>{items.length} itens</span></div></header>
    {notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}
    <section className="capture"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Capture uma ideia antes que ela escape…"/><button className="primary" onClick={capture}>Adicionar à Inbox</button></section>
    <section className="toolbar"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no blueprint"/><span>Ideias, notas e tarefas no mesmo lugar.</span></section>
    <section className="board">{statuses.map((status) => <article key={status}><h2>{label[status]} <small>{items.filter((item) => item.status === status).length}</small></h2>{items.filter((item) => item.status === status).map((item) => <div className="card" key={item.id}><div className="card-meta"><span>{item.type}</span><span>{item.priority}</span></div><strong>{item.title}</strong>{item.body && item.body !== item.title && <p>{item.body}</p>}<div className="tags">{item.tags.map((tag) => <i key={tag}>#{tag}</i>)}</div><select value={item.status} onChange={(e) => move(item, e.target.value)}>{statuses.map((value) => <option key={value} value={value}>{label[value]}</option>)}</select></div>)}</article>)}</section>
    <section className="assistant"><div><small>ASSISTENTE GPT</small><h2>Organize seu contexto</h2><p>Peça para resumir, priorizar ou transformar suas ideias em um plano de ação.</p><textarea value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Ex.: priorize minhas ideias e sugira os próximos passos"/><button className="primary" onClick={ask}>Consultar GPT</button></div><pre>{answer || "As sugestões aparecerão aqui. As alterações continuam sob sua confirmação."}</pre></section>
    {settings && <div className="modal"><div><h2>Configurar GPT</h2><p>A chave fica somente no banco local do My Blueprint.</p><label>Chave OpenAI<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…"/></label><label>Modelo<input value={model} onChange={(e) => setModel(e.target.value)}/></label><footer><button onClick={() => setSettings(false)}>Cancelar</button><button className="primary" onClick={save}>Salvar</button></footer></div></div>}
  </main>
}
ReactDOM.createRoot(document.getElementById("gui")!).render(<App />)
