import * as React from "react"
import { useState } from "react"
import { Modal, Icon } from "semantic-ui-react"

import { toast, errMessage } from "../../Utils/toast"

type Props = { api:(name:string)=>any, keystone:string, open:boolean, onClose:()=>void, onCreated:(tableName:string)=>void }

const TYPES = ["INTEGER","STRING","TEXT","BIGINT","FLOAT","REAL","DECIMAL","BOOLEAN","DATE","DATEONLY","JSON","BLOB","UUID"]

const emptyCol = () => ({name:"", type:"STRING", allowNull:true, primaryKey:false, autoIncrement:false})

const CreateTableModal = ({api, keystone, open, onClose, onCreated}:Props) => {

    const [tableName, setTableName] = useState("")
    const [columns, setColumns]     = useState<any[]>([{name:"id", type:"INTEGER", allowNull:false, primaryKey:true, autoIncrement:true}])
    const [error, setError]         = useState<string>()

    const patch = (i:number, key:string, value:any) =>
        setColumns(columns.map((c, idx) => idx===i ? {...c, [key]:value} : c))

    const create = () => {
        const cols = columns.filter((c)=>c.name.trim())
        if(!tableName.trim() || cols.length===0){ setError("Informe o nome da tabela e ao menos uma coluna."); return }
        api("RelacionalDatabaseHandler").CreateTable({keystone, tableName, columns:cols})
        .then(()=>{ toast.ok(`Tabela "${tableName}" criada`); reset(); onCreated(tableName) })
        .catch((e:any)=>setError(errMessage(e)))
    }

    const reset = () => { setTableName(""); setColumns([{name:"id", type:"INTEGER", allowNull:false, primaryKey:true, autoIncrement:true}]); setError(undefined) }
    const close = () => { reset(); onClose() }

    return <Modal open={open} onClose={close} size="small">
        <Modal.Header>Nova tabela</Modal.Header>
        <Modal.Content>
            {error && <div className="ds-banner err" style={{marginBottom:12}}>{error}</div>}
            <div style={{marginBottom:12}}>
                <input className="ds-input" style={{width:"100%"}} placeholder="nome da tabela"
                    value={tableName} onChange={(e)=>setTableName(e.target.value)}/>
            </div>
            <table className="ds-grid" style={{width:"100%", fontFamily:"var(--mp-font-ui)"}}>
                <thead><tr><th>Coluna</th><th>Tipo</th><th>Nulo</th><th>PK</th><th>Auto</th><th></th></tr></thead>
                <tbody>
                    {columns.map((c, i)=>
                        <tr key={i}>
                            <td><input className="ds-input" value={c.name} onChange={(e)=>patch(i,"name",e.target.value)}/></td>
                            <td><select className="ds-input" value={c.type} onChange={(e)=>patch(i,"type",e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></td>
                            <td style={{textAlign:"center"}}><input type="checkbox" checked={c.allowNull} onChange={(e)=>patch(i,"allowNull",e.target.checked)}/></td>
                            <td style={{textAlign:"center"}}><input type="checkbox" checked={c.primaryKey} onChange={(e)=>patch(i,"primaryKey",e.target.checked)}/></td>
                            <td style={{textAlign:"center"}}><input type="checkbox" checked={c.autoIncrement} onChange={(e)=>patch(i,"autoIncrement",e.target.checked)}/></td>
                            <td><Icon name="close" style={{cursor:"pointer"}} onClick={()=>setColumns(columns.filter((_,idx)=>idx!==i))}/></td>
                        </tr>)}
                </tbody>
            </table>
            <button className="ds-btn ds-btn--sm" style={{marginTop:10}} onClick={()=>setColumns([...columns, emptyCol()])}>
                <Icon name="plus" fitted/> Adicionar coluna
            </button>
        </Modal.Content>
        <Modal.Actions>
            <button className="ds-btn ds-btn--sm" onClick={close}>Cancelar</button>
            <button className="ds-btn ds-btn--sm primary" onClick={create}><Icon name="check" fitted/> Criar tabela</button>
        </Modal.Actions>
    </Modal>
}

export default CreateTableModal
