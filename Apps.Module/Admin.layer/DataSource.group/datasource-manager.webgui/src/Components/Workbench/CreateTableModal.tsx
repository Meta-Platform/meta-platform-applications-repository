import * as React from "react"
import { useState } from "react"

import {
    Banner, Button, CheckboxInput, Dialog, FormField,
    IconButton, SelectInput, TextInput
} from "@i-components"

import { toast, errMessage } from "../../Utils/toast"

type Props = { api:(name:string)=>any, keystone:string, open:boolean, onClose:()=>void, onCreated:(tableName:string)=>void }

const TYPES = ["INTEGER","STRING","TEXT","BIGINT","FLOAT","REAL","DECIMAL","BOOLEAN","DATE","DATEONLY","JSON","BLOB","UUID"]

const TYPE_OPTIONS = TYPES.map((type) => ({ value: type, label: type }))

const emptyCol = () => ({name:"", type:"STRING", allowNull:true, primaryKey:false, autoIncrement:false})

const firstCol = () => ({name:"id", type:"INTEGER", allowNull:false, primaryKey:true, autoIncrement:true})

const CreateTableModal = ({api, keystone, open, onClose, onCreated}:Props) => {

    const [tableName, setTableName] = useState("")
    const [columns, setColumns]     = useState<any[]>([firstCol()])
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

    const reset = () => { setTableName(""); setColumns([firstCol()]); setError(undefined) }
    const close = () => { reset(); onClose() }

    return <Dialog
        open    = {open}
        size    = "lg"
        icon    = "table"
        title   = "Nova tabela"
        onClose = {close}
        actions = {<>
            <Button onClick={close}>Cancelar</Button>
            <Button variant="primary" icon="check" onClick={create}>Criar tabela</Button>
        </>}>

        {error && <Banner tone="danger" title="Não foi possível criar">{error}</Banner>}

        <FormField label="Nome da tabela" required>
            <TextInput
                placeholder = "nome da tabela"
                value       = {tableName}
                onChange    = {(e:any)=>setTableName(e.target.value)}/>
        </FormField>

        <div className="ds-colhead">
            <span>Coluna</span>
            <span>Tipo</span>
            <span>Nulo</span>
            <span>PK</span>
            <span>Auto</span>
            <span/>
        </div>

        {columns.map((c, i) =>
            <div className="ds-colrow" key={i}>
                <TextInput
                    placeholder = "nome"
                    value       = {c.name}
                    onChange    = {(e:any)=>patch(i,"name",e.target.value)}/>
                <SelectInput
                    options  = {TYPE_OPTIONS}
                    value    = {c.type}
                    onChange = {(e:any)=>patch(i,"type",e.target.value)}/>
                <CheckboxInput checked={c.allowNull}     onChange={(e:any)=>patch(i,"allowNull",e.target.checked)}/>
                <CheckboxInput checked={c.primaryKey}    onChange={(e:any)=>patch(i,"primaryKey",e.target.checked)}/>
                <CheckboxInput checked={c.autoIncrement} onChange={(e:any)=>patch(i,"autoIncrement",e.target.checked)}/>
                <IconButton
                    icon    = "close"
                    label   = "Remover coluna"
                    size    = "sm"
                    onClick = {()=>setColumns(columns.filter((_,idx)=>idx!==i))}/>
            </div>)}

        <Button size="sm" icon="plus" onClick={()=>setColumns([...columns, emptyCol()])}>Adicionar coluna</Button>
    </Dialog>
}

export default CreateTableModal
