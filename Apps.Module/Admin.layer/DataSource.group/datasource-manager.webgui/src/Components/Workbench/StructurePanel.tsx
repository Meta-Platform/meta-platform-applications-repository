import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import { Icon } from "semantic-ui-react"

type Props = {
    api:(name:string)=>any, keystone:string, tableName:string,
    onChanged?:()=>void, onDropped?:()=>void
}

const TYPES = ["STRING","TEXT","INTEGER","BIGINT","FLOAT","REAL","DECIMAL","BOOLEAN","DATE","DATEONLY","TIME","JSON","BLOB","UUID"]

const StructurePanel = ({api, keystone, tableName, onChanged, onDropped}:Props) => {

    const rdb = useCallback(() => api("RelacionalDatabaseHandler"), [api])

    const [cols, setCols]       = useState<any[]>([])
    const [indexes, setIndexes] = useState<any[]>([])
    const [error, setError]     = useState<string>()
    const [adding, setAdding]   = useState(false)
    const [newCol, setNewCol]   = useState<any>({name:"", type:"STRING", allowNull:true, defaultValue:""})

    const fail = (e:any) => setError((e?.response?.data?.message) || e?.message || String(e))

    const load = useCallback(() => {
        setError(undefined)
        rdb().DescribeTable({keystone, tableName}).then(({data}:any)=>setCols(data||[])).catch(fail)
        rdb().ShowTableIndexes({keystone, tableName}).then(({data}:any)=>setIndexes(data||[])).catch(()=>setIndexes([]))
    }, [rdb, keystone, tableName])

    useEffect(load, [load])

    const addColumn = () => {
        if(!newCol.name.trim()) return
        rdb().AddColumn({keystone, tableName, column:newCol})
        .then(()=>{ setAdding(false); setNewCol({name:"", type:"STRING", allowNull:true, defaultValue:""}); load(); onChanged && onChanged() })
        .catch(fail)
    }

    const removeColumn = (name:string) => {
        if(!window.confirm(`Remover a coluna "${name}"?`)) return
        rdb().RemoveColumn({keystone, tableName, columnName:name}).then(()=>{ load(); onChanged && onChanged() }).catch(fail)
    }

    const dropTable = () => {
        if(!window.confirm(`DROPAR a tabela "${tableName}"? Esta ação é irreversível.`)) return
        rdb().DropTable({keystone, tableName}).then(()=>{ onChanged && onChanged(); onDropped && onDropped() }).catch(fail)
    }

    return <div className="ds-tabpanel ds-struct">
        {error && <div className="ds-banner err" style={{marginBottom:12}}>{error}</div>}

        <h4>Colunas</h4>
        <table className="ds-grid" style={{width:"100%", fontFamily:"var(--mp-font-ui)"}}>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Nulo?</th><th>Default</th><th>PK</th><th></th></tr></thead>
            <tbody>
                {cols.map((c)=>
                    <tr key={c.name}>
                        <td>{c.name}</td>
                        <td>{String(c.type)}</td>
                        <td>{c.allowNull ? "sim" : "não"}</td>
                        <td>{c.defaultValue===null||c.defaultValue===undefined?<span className="ds-null">—</span>:String(c.defaultValue)}</td>
                        <td>{c.primaryKey ? <Icon name="key" color="yellow"/> : ""}</td>
                        <td><Icon name="trash alternate outline" title="Remover coluna" style={{cursor:"pointer"}} onClick={()=>removeColumn(c.name)}/></td>
                    </tr>)}
                {adding && <tr>
                    <td><input className="ds-input" placeholder="nome" value={newCol.name} onChange={(e)=>setNewCol({...newCol, name:e.target.value})}/></td>
                    <td><select className="ds-input" value={newCol.type} onChange={(e)=>setNewCol({...newCol, type:e.target.value})}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></td>
                    <td><input type="checkbox" checked={newCol.allowNull} onChange={(e)=>setNewCol({...newCol, allowNull:e.target.checked})}/></td>
                    <td><input className="ds-input" placeholder="default" value={newCol.defaultValue} onChange={(e)=>setNewCol({...newCol, defaultValue:e.target.value})}/></td>
                    <td></td>
                    <td>
                        <Icon name="check" title="Adicionar" style={{cursor:"pointer"}} onClick={addColumn}/>
                        <Icon name="close" title="Cancelar" style={{cursor:"pointer"}} onClick={()=>setAdding(false)}/>
                    </td>
                </tr>}
            </tbody>
        </table>

        <div style={{margin:"12px 0", display:"flex", gap:8}}>
            <button className="ds-btn ds-btn--sm primary" onClick={()=>setAdding(true)} disabled={adding}><Icon name="plus" fitted/> Adicionar coluna</button>
            <button className="ds-btn ds-btn--sm danger" onClick={dropTable}><Icon name="trash" fitted/> Dropar tabela</button>
        </div>

        {indexes.length>0 && <>
            <h4 style={{marginTop:20}}>Índices</h4>
            <table className="ds-grid" style={{width:"100%", fontFamily:"var(--mp-font-ui)"}}>
                <thead><tr><th>Nome</th><th>Único</th><th>Campos</th></tr></thead>
                <tbody>
                    {indexes.map((idx:any, i:number)=>
                        <tr key={i}>
                            <td>{idx.name}</td>
                            <td>{idx.unique ? "sim" : "não"}</td>
                            <td>{(idx.fields||[]).map((f:any)=>f.attribute||f.name||f).join(", ")}</td>
                        </tr>)}
                </tbody>
            </table>
        </>}
    </div>
}

export default StructurePanel
