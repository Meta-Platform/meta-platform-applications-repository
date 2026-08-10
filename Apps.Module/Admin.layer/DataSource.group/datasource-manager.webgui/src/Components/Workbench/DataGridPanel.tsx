import * as React from "react"
import { useEffect, useState, useCallback } from "react"

import {
    Banner, Button, DataColumn, DataTable, IconButton,
    SelectInput, Spinner, TextInput, Toolbar
} from "@i-components"

import { toast, errMessage } from "../../Utils/toast"

type Props = { api:(name:string)=>any, keystone:string, tableName:string }

type ColMeta = { name:string, type?:string, allowNull?:boolean, primaryKey?:boolean }

// Linha como a grade a enxerga: o registro do banco mais a posição, porque a
// edição é endereçada por posição (a tabela pode não ter chave primária).
type GridRow = { __row?:any, __index?:number, __draft?:boolean }

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

const PAGE_SIZES = [50, 100, 500, 1000]

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

    // A ordenação mora na barra de ferramentas, não no cabeçalho: a `DataTable`
    // do kit é dirigida por dados e não expõe clique de coluna. O cabeçalho
    // continua mostrando por onde a grade está ordenada.
    const changeOrderBy = (col:string) => { setOrderBy(col || undefined); setOffset(0) }
    const toggleOrderDir = () => { setOrderDir(orderDir === "ASC" ? "DESC" : "ASC"); setOffset(0) }

    const header = (col:string) => [
        col,
        pkColumns.indexOf(col) >= 0 ? "· PK" : "",
        orderBy === col ? (orderDir === "DESC" ? "▼" : "▲") : ""
    ].filter(Boolean).join(" ")

    const renderValue = (row:any, index:number, col:string) => {
        if(editing && editing.i === index && editing.col === col)
            return <TextInput
                className = "ds-cellinput"
                autoFocus
                value     = {editValue}
                onChange  = {(e:any)=>setEditValue(e.target.value)}
                onBlur    = {commitEdit}
                onKeyDown = {(e:any)=>{ if(e.key==="Enter") commitEdit(); if(e.key==="Escape") setEditing(null) }}/>

        const value = row[col]
        return <span className="ds-cell ds-cell--editable" title="duplo-clique para editar" onDoubleClick={()=>startEdit(index, col, value)}>
            { value === null || value === undefined
                ? <span className="ds-null">NULL</span>
                : (typeof value === "object" ? JSON.stringify(value) : String(value)) }
        </span>
    }

    const gridColumns:DataColumn[] = [
        {
            key    : "__gutter",
            header : "",
            width  : 40,
            align  : "center",
            render : (item:GridRow) => item.__draft
                ? <IconButton icon="save" label="Salvar linha" size="sm" onClick={saveDraft}/>
                : <IconButton icon="trash alternate outline" label="Excluir linha" size="sm" onClick={()=>deleteRow(item.__row)}/>
        },
        ...columns.map((col) => ({
            key    : col,
            header : header(col),
            mono   : true,
            render : (item:GridRow) => item.__draft
                ? <TextInput
                    className   = "ds-cellinput"
                    autoFocus   = {col === columns[0]}
                    value       = {(draft && draft[col]) || ""}
                    placeholder = {metaByName(col)?.allowNull ? "NULL" : ""}
                    onChange    = {(e:any)=>setDraft({...(draft||{}), [col]:e.target.value})}/>
                : renderValue(item.__row, item.__index as number, col)
        }))
    ]

    const gridRows:GridRow[] = [
        ...(draft ? [ { __draft:true } ] : []),
        ...rows.map((row, index) => ({ __row:row, __index:index }))
    ]

    return <div className="ds-panel">
        <Toolbar className="ds-toolbar">
            <Button size="sm" icon="refresh" onClick={loadRows}>Recarregar</Button>
            <Button size="sm" variant="primary" icon="plus" onClick={() => setDraft({})} disabled={!!draft}>Inserir linha</Button>
            <Toolbar.Separator/>
            <SelectInput
                className   = "ds-order"
                placeholder = "sem ordenação"
                options     = {columns.map((col) => ({ value: col, label: col }))}
                value       = {orderBy || ""}
                onChange    = {(e:any)=>changeOrderBy(e.target.value)}/>
            <IconButton
                icon     = {orderDir === "DESC" ? "sort content descending" : "sort down"}
                label    = {orderDir === "DESC" ? "ordem decrescente" : "ordem crescente"}
                size     = "sm"
                disabled = {!orderBy}
                onClick  = {toggleOrderDir}/>
            <Toolbar.Spacer/>
            <span className="ds-pageinfo">{from}–{to} de {total}</span>
            <IconButton icon="chevron left"  label="página anterior" size="sm" disabled={offset<=0}  onClick={() => setOffset(Math.max(0, offset-limit))}/>
            <IconButton icon="chevron right" label="próxima página"  size="sm" disabled={to>=total} onClick={() => setOffset(offset+limit)}/>
            <SelectInput
                className = "ds-pagesize"
                options   = {PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} / pág` }))}
                value     = {String(limit)}
                onChange  = {(e:any)=>{ setLimit(Number(e.target.value)); setOffset(0) }}/>
        </Toolbar>

        {noPk && <Banner className="ds-strip" tone="warning">Tabela sem chave primária — edição/exclusão usam a linha inteira como filtro (pode afetar linhas idênticas).</Banner>}
        {error && <Banner className="ds-strip" tone="danger" title="Erro">{error}</Banner>}
        {loading && <div className="ds-loading"><Spinner label="carregando linhas"/> carregando…</div>}

        <DataTable
            className    = "ds-grid"
            dense        = {true}
            columns      = {gridColumns}
            rows         = {gridRows}
            rowKey       = {(item:GridRow) => item.__draft ? "draft" : `row-${item.__index}`}
            emptyMessage = "tabela vazia"/>
    </div>
}

export default DataGridPanel
