import * as React from "react"
import { useEffect, useState } from "react"
import { Icon } from "semantic-ui-react"

import useApi from "../Hooks/useApi"
import { WorkItem } from "../api/types"
import { ErrorBanner } from "./Primitives"

const RELATIONS = ["blocks", "depends", "relates", "duplicates", "implements", "tests"]

interface LinkPanelProps {
    item: WorkItem
    projectId?: string
    onChanged: () => void
}

// LinkPanel (feature 1): cria/remove vínculos entre itens. O alvo é buscado por
// ListItems?text= (autocomplete key+título); títulos dos vínculos existentes são
// resolvidos por um mapa carregado do projeto.
const LinkPanel = ({ item, projectId, onChanged }: LinkPanelProps) => {
    const api = useApi()
    const [relation, setRelation] = useState("relates")
    const [query, setQuery] = useState("")
    const [suggestions, setSuggestions] = useState<WorkItem[]>([])
    const [target, setTarget] = useState<WorkItem | null>(null)
    const [resolved, setResolved] = useState<{ [id: string]: WorkItem }>({})
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // mapa id->item do projeto (para exibir key/título dos vínculos)
    useEffect(() => {
        if (!projectId) return
        api.items.list(projectId, {})
            .then((l) => {
                const m: { [id: string]: WorkItem } = {}
                    ; (l || []).forEach((it) => { m[it.id] = it })
                setResolved(m)
            })
            .catch(() => {})
    }, [projectId, item.id])

    const onQuery = (text: string) => {
        setQuery(text); setTarget(null)
        if (!projectId || !text.trim()) { setSuggestions([]); return }
        api.items.list(projectId, { text })
            .then((l) => setSuggestions((l || []).filter((it) => it.id !== item.id).slice(0, 8)))
            .catch(() => setSuggestions([]))
    }

    const pick = (it: WorkItem) => { setTarget(it); setQuery(`${it.key} · ${it.title}`); setSuggestions([]) }

    const add = async () => {
        // aceita item escolhido (id) ou o texto cru (id/key digitado)
        const targetRef = target ? target.id : query.trim()
        if (!targetRef) return
        setBusy(true); setError(null)
        try {
            await api.items.link(item.id, relation, targetRef)
            setQuery(""); setTarget(null); setSuggestions([]); onChanged()
        } catch (e: any) { setError(e.message) } finally { setBusy(false) }
    }

    const remove = async (rel: string, targetItemId: string) => {
        setError(null)
        try { await api.items.unlink(item.id, rel, targetItemId); onChanged() }
        catch (e: any) { setError(e.message) }
    }

    const links = item.links || []

    return <div className="mpm-col">
        <div className="mpm-section-title"><Icon name="linkify" /> Vínculos ({links.length})</div>
        <ErrorBanner error={error} />

        {links.map((l) => {
            const t = resolved[l.targetItemId]
            return <div key={l.id} className="mpm-row">
                <span className="mpm-chip mpm-chip--neutral">{l.relation}</span>
                <span className="mpm-mono mpm-muted">{t ? t.key : l.targetItemId}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t ? t.title : ""}</span>
                <Icon name="trash" link className="mpm-muted" title="Remover vínculo"
                    onClick={() => remove(l.relation, l.targetItemId)} />
            </div>
        })}

        <div className="mpm-row">
            <select className="mpm-inline-select" value={relation} onChange={(e) => setRelation(e.target.value)}>
                {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ position: "relative", flex: 1 }}>
                <input className="mpm-input" placeholder="buscar item alvo (key ou título)..."
                    value={query} onChange={(e) => onQuery(e.target.value)} />
                {suggestions.length > 0
                    ? <div className="mpm-card" style={{ position: "absolute", zIndex: 50, left: 0, right: 0, top: "36px", padding: "4px", maxHeight: "200px", overflowY: "auto" }}>
                        {suggestions.map((s) =>
                            <div key={s.id} className="mpm-cmd__item" onClick={() => pick(s)}>
                                <span className="mpm-mono mpm-muted">{s.key}</span> {s.title}
                            </div>)}
                    </div>
                    : null}
            </div>
            <button className="mpm-btn mpm-btn--sm" disabled={busy || (!target && !query.trim())} onClick={add}>
                <Icon name="plus" /> Vincular
            </button>
        </div>
    </div>
}

export default LinkPanel
