import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { Icon } from "semantic-ui-react"

import { toast, errMessage } from "../../Utils/toast"

type Props = { api:(name:string)=>any, keystone:string, tableName:string }

type ColMeta = { name:string, type?:string, allowNull?:boolean, primaryKey?:boolean }

const isNumericType = (type?:string) =>
    /INT|DECIMAL|NUMERIC|FLOAT|REAL|DOUBLE/i.test(type || "")

// Converte o texto do input para o tipo apropriado antes de gravar.
const coerce = (raw:string, meta?:ColMeta) => {
    if(raw === "") return null
    if(meta && isNumericType(meta.type)){
        const n = Number(raw)
        return isNaN(n) ? raw : n
    }
    return raw
}

const DataGridPanel = ({api, keystone, tableName}:Props) => {

    const rdb = useCallback(() => api("RelacionalDatabaseHandler"), [api])

    const [meta, setMeta]       = useState<ColMeta[]>([])
    const [columns, setColumns] = useState<string[]>([])
    const [rows, setRows]       = useState<any[]>([])
    const [total, setTotal]     = useState(0)
    const [limit, setLimit]     = useState(100)
    const [offset, setOffset]   = useState(0)
    const [orderBy, setOrderBy] = useState<string>()
    const [orderDir, setOrderDir] = useState<"ASC"|"DESC">("ASC")

    const [loading, setLoading] = useState(false)
    const [error, setError]     = useState<string>()

    const [editing, setEditing]   = useState<{i:number, col:string}|null>(null)
    const [editValue, setEditValue] = useState<string>("")
    const [draft, setDraft]       = useState<Record<string,string>|null>(null)

    const pkColumns = meta.filter((m) => m.primaryKey).map((m) => m.name)
    const noPk = meta.length > 0 && pkColumns.length === 0
    const metaByName = (col:string) => meta.find((m) => m.name === col)

    const fail = (e:any) => setError(errMessage(e))

    const loadMeta = useCallback(() => {
        rdb().DescribeTable({keystone, tableName})
        .then(({data}:any) => setMeta(data || []))
        .catch(()=>{})
    }, [rdb, keystone, tableName])

    const loadRows = useCallback(() => {
        setLoading(true); setError(undefined)
        rdb().SelectRows({keystone, tableName, limit, offset, orderBy, orderDir})
        .then(({data}:any) => {
            setRows(data.rows || [])
            setColumns(data.columns || [])
            setTotal(data.total || 0)
        })
        .catch(fail)
        .finally(() => setLoading(false))
    }, [rdb, keystone, tableName, limit, offset, orderBy, orderDir])

    useEffect(() => { setOffset(0); setOrderBy(undefined); setDraft(null); setEditing(null); loadMeta() }, [keystone, tableName])
    useEffect(() => { loadRows() }, [loadRows])

    const whereForRow = (row:any) => {
        const keys = pkColumns.length ? pkColumns : columns
        return keys.reduce((w:any, k:string) => { w[k] = row[k]; return w }, {})
    }

    const handleSort = (col:string) => {
        if(orderBy === col) setOrderDir(orderDir === "ASC" ? "DESC" : "ASC")
        else { setOrderBy(col); setOrderDir("ASC") }
        setOffset(0)
    }

    const startEdit = (i:number, col:string, current:any) => {
        setEditing({i, col})
        setEditValue(current === null || current === undefined ? "" : String(current))
    }

    const commitEdit = () => {
        if(!editing) return
        const row = rows[editing.i]
        const col = editing.col
        const newVal = coerce(editValue, metaByName(col))
        setEditing(null)
        if(String(row[col] ?? "") === String(newVal ?? "")) return
        rdb().UpdateRow({keystone, tableName, values:{[col]:newVal}, where:whereForRow(row)})
        .then(() => { toast.ok("Linha atualizada"); loadRows() })
        .catch((e:any) => toast.err(errMessage(e)))
    }

    const deleteRow = (row:any) => {
        if(!window.confirm("Excluir esta linha?")) return
        rdb().DeleteRow({keystone, tableName, where:whereForRow(row)})
        .then(() => { toast.ok("Linha excluída"); loadRows() })
        .catch((e:any) => toast.err(errMessage(e)))
    }

    const saveDraft = () => {
        if(!draft) return
        const values = Object.keys(draft).reduce((acc:any, k:string) => {
            if(draft[k] !== "") acc[k] = coerce(draft[k], metaByName(k))
            return acc
        }, {})
        rdb().InsertRow({keystone, tableName, values})
        .then(() => { toast.ok("Linha inserida"); setDraft(null); loadRows() })
        .catch((e:any) => toast.err(errMessage(e)))
    }

    const from = total === 0 ? 0 : offset + 1
    const to   = offset + rows.length

    return <div className="ds-tabpanel">
        <div className="ds-toolbar">
            <button className="ds-btn ds-btn--sm" onClick={loadRows}><Icon name="refresh" fitted/> Recarregar</button>
            <button className="ds-btn ds-btn--sm primary" onClick={() => setDraft({})} disabled={!!draft}><Icon name="plus" fitted/> Inserir linha</button>
            <div className="ds-toolbar__spacer"/>
            <span className="ds-pageinfo">{from}–{to} de {total}</span>
            <button className="ds-btn ds-btn--sm" disabled={offset<=0} onClick={() => setOffset(Math.max(0, offset-limit))}><Icon name="chevron left" fitted/></button>
            <button className="ds-btn ds-btn--sm" disabled={to>=total} onClick={() => setOffset(offset+limit)}><Icon name="chevron right" fitted/></button>
            <select className="ds-input" value={limit} onChange={(e)=>{setLimit(Number(e.target.value)); setOffset(0)}}>
                {[50,100,500,1000].map((n)=><option key={n} value={n}>{n} / pág</option>)}
            </select>
        </div>

        {noPk && <div className="ds-warnbar"><Icon name="warning sign" fitted/> Tabela sem chave primária — edição/exclusão usam a linha inteira como filtro (pode afetar linhas idênticas).</div>}
        {error && <div className="ds-banner err">{error}</div>}
        {loading && <div className="ds-loading">carregando…</div>}

        <div className="ds-grid__scroll">
            <table className="ds-grid">
                <thead>
                    <tr>
                        <th className="ds-rowgutter"></th>
                        {columns.map((col) =>
                            <th key={col} className={pkColumns.includes(col)?"pk":""} onClick={()=>handleSort(col)}>
                                {col}{orderBy===col && <span className="ds-sortdir">{orderDir==="DESC"?"▼":"▲"}</span>}
                            </th>)}
                    </tr>
                </thead>
                <tbody>
                    {draft && <tr>
                        <td className="ds-rowgutter">
                            <Icon name="save" title="Salvar" style={{cursor:"pointer"}} onClick={saveDraft}/>
                        </td>
                        {columns.map((col) =>
                            <td key={col}>
                                <input className="ds-cellinput" autoFocus={col===columns[0]}
                                    value={draft[col] ?? ""}
                                    placeholder={metaByName(col)?.allowNull ? "NULL" : ""}
                                    onChange={(e)=>setDraft({...draft, [col]:e.target.value})}/>
                            </td>)}
                    </tr>}
                    {rows.map((row, i) =>
                        <tr key={i}>
                            <td className="ds-rowgutter">
                                <Icon name="trash alternate outline" title="Excluir" style={{cursor:"pointer"}} onClick={()=>deleteRow(row)}/>
                            </td>
                            {columns.map((col) => {
                                const editingHere = editing && editing.i===i && editing.col===col
                                const value = row[col]
                                return <td key={col}
                                        className={value===null?"ds-null":""}
                                        onDoubleClick={()=>startEdit(i, col, value)}>
                                    {editingHere
                                        ? <input className="ds-cellinput" autoFocus value={editValue}
                                            onChange={(e)=>setEditValue(e.target.value)}
                                            onBlur={commitEdit}
                                            onKeyDown={(e)=>{ if(e.key==="Enter") commitEdit(); if(e.key==="Escape") setEditing(null) }}/>
                                        : (value===null||value===undefined ? "NULL" : (typeof value==="object"?JSON.stringify(value):String(value)))}
                                </td>
                            })}
                        </tr>)}
                    {!loading && rows.length===0 && !draft &&
                        <tr><td colSpan={columns.length+1} className="ds-tables__empty">tabela vazia</td></tr>}
                </tbody>
            </table>
        </div>
    </div>
}

export default DataGridPanel
