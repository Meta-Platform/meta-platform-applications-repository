import * as React from "react"
import { useEffect, useState, useCallback } from "react"

import {
    Banner, Button, CheckboxInput, DataColumn, DataTable, FormField,
    Icon, IconButton, KeyValueList, Panel, SelectInput, TextInput
} from "@i-components"

import { toast, errMessage } from "../../Utils/toast"

type Props = {
    api:(name:string)=>any, keystone:string, tableName:string,
    onChanged?:()=>void, onDropped?:()=>void
}

const TYPES = ["STRING","TEXT","INTEGER","BIGINT","FLOAT","REAL","DECIMAL","BOOLEAN","DATE","DATEONLY","TIME","JSON","BLOB","UUID"]

const TYPE_OPTIONS = TYPES.map((type) => ({ value: type, label: type }))

const StructurePanel = ({api, keystone, tableName, onChanged, onDropped}:Props) => {

    const rdb = useCallback(() => api("RelacionalDatabaseHandler"), [api])

    const [cols, setCols]       = useState<any[]>([])
    const [indexes, setIndexes] = useState<any[]>([])
    const [error, setError]     = useState<string>()
    const [adding, setAdding]   = useState(false)
    const [newCol, setNewCol]   = useState<any>({name:"", type:"STRING", allowNull:true, defaultValue:""})

    const fail = (e:any) => { setError(errMessage(e)); toast.err(errMessage(e)) }

    const load = useCallback(() => {
        setError(undefined)
        rdb().DescribeTable({keystone, tableName}).then(({data}:any)=>setCols(data||[])).catch(fail)
        rdb().ShowTableIndexes({keystone, tableName}).then(({data}:any)=>setIndexes(data||[])).catch(()=>setIndexes([]))
    }, [rdb, keystone, tableName])

    useEffect(load, [load])

    const addColumn = () => {
        if(!newCol.name.trim()) return
        rdb().AddColumn({keystone, tableName, column:newCol})
        .then(()=>{ toast.ok(`Coluna "${newCol.name}" adicionada`); setAdding(false); setNewCol({name:"", type:"STRING", allowNull:true, defaultValue:""}); load(); onChanged && onChanged() })
        .catch(fail)
    }

    const removeColumn = (name:string) => {
        if(!window.confirm(`Remover a coluna "${name}"?`)) return
        rdb().RemoveColumn({keystone, tableName, columnName:name})
        .then(()=>{ toast.ok(`Coluna "${name}" removida`); load(); onChanged && onChanged() }).catch(fail)
    }

    const dropTable = () => {
        if(!window.confirm(`DROPAR a tabela "${tableName}"? Esta ação é irreversível.`)) return
        rdb().DropTable({keystone, tableName})
        .then(()=>{ toast.ok(`Tabela "${tableName}" removida`); onChanged && onChanged(); onDropped && onDropped() }).catch(fail)
    }

    const primaryKeys = cols.filter((c) => c.primaryKey).map((c) => c.name)

    const columnColumns:DataColumn[] = [
        { key: "name",         header: "Nome",    mono: true },
        { key: "type",         header: "Tipo",    render: (c:any) => String(c.type) },
        { key: "allowNull",    header: "Nulo?",   render: (c:any) => c.allowNull ? "sim" : "não" },
        { key: "defaultValue", header: "Default", mono: true,
          render: (c:any) => c.defaultValue === null || c.defaultValue === undefined
                ? <span className="ds-null">—</span>
                : String(c.defaultValue) },
        { key: "primaryKey",   header: "PK", align: "center",
          render: (c:any) => c.primaryKey ? <Icon name="key" tone="warning" title="chave primária"/> : null },
        { key: "__actions",    header: "", width: 44, align: "center",
          render: (c:any) => <IconButton icon="trash alternate outline" label="Remover coluna" size="sm" onClick={()=>removeColumn(c.name)}/> }
    ]

    const indexColumns:DataColumn[] = [
        { key: "name",   header: "Nome",   mono: true },
        { key: "unique", header: "Único",  render: (idx:any) => idx.unique ? "sim" : "não" },
        { key: "fields", header: "Campos", mono: true,
          render: (idx:any) => (idx.fields||[]).map((f:any)=>f.attribute||f.name||f).join(", ") }
    ]

    return <div className="ds-panel ds-struct">
        {error && <Banner tone="danger" title="Erro">{error}</Banner>}

        <KeyValueList
            columns = {3}
            items   = {[
                { label: "Tabela",        value: tableName,                                 mono: true },
                { label: "Colunas",       value: String(cols.length) },
                { label: "Chave primária", value: primaryKeys.length ? primaryKeys.join(", ") : "—", mono: true }
            ]}/>

        <Panel
            title   = "Colunas"
            icon    = "columns"
            actions = {<>
                <Button size="sm" variant="primary" icon="plus" onClick={()=>setAdding(true)} disabled={adding}>Adicionar coluna</Button>
                <Button size="sm" variant="danger" icon="trash" onClick={dropTable}>Dropar tabela</Button>
            </>}>

            <DataTable
                className    = "ds-struct__table"
                dense        = {true}
                columns      = {columnColumns}
                rows         = {cols}
                rowKey       = {(c:any) => c.name}
                emptyMessage = "sem colunas"/>

            {/* O formulário de nova coluna deixou de ser uma linha de inputs
                dentro da tabela: a DataTable do kit é dirigida por dados. */}
            {adding &&
                <div className="ds-form">
                    <FormField label="Nome" required>
                        <TextInput
                            autoFocus
                            placeholder = "nome da coluna"
                            value       = {newCol.name}
                            onChange    = {(e:any)=>setNewCol({...newCol, name:e.target.value})}/>
                    </FormField>
                    <FormField label="Tipo">
                        <SelectInput
                            options  = {TYPE_OPTIONS}
                            value    = {newCol.type}
                            onChange = {(e:any)=>setNewCol({...newCol, type:e.target.value})}/>
                    </FormField>
                    <FormField label="Default">
                        <TextInput
                            placeholder = "sem default"
                            value       = {newCol.defaultValue}
                            onChange    = {(e:any)=>setNewCol({...newCol, defaultValue:e.target.value})}/>
                    </FormField>
                    <FormField label="Aceita nulo">
                        <CheckboxInput
                            label    = "NULL permitido"
                            checked  = {newCol.allowNull}
                            onChange = {(e:any)=>setNewCol({...newCol, allowNull:e.target.checked})}/>
                    </FormField>
                    <div className="ds-form__actions">
                        <Button size="sm" onClick={()=>setAdding(false)}>Cancelar</Button>
                        <Button size="sm" variant="primary" icon="check" onClick={addColumn}>Adicionar</Button>
                    </div>
                </div>}
        </Panel>

        {indexes.length > 0 &&
            <Panel title="Índices" icon="list layout">
                <DataTable
                    className = "ds-struct__table"
                    dense     = {true}
                    columns   = {indexColumns}
                    rows      = {indexes}
                    rowKey    = {(idx:any, i:number) => idx.name || String(i)}/>
            </Panel>}
    </div>
}

export default StructurePanel
