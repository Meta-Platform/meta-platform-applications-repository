import * as React from "react"
import {useState, useEffect} from "react"
import {
    Button, CheckboxInput, DataTable, Icon, IconButton, Panel, SelectInput, TextInput
} from "@i-components"

const IN_OPTIONS = [
    { value: "body",  label: "body" },
    { value: "path",  label: "path" },
    { value: "query", label: "query" }
]

const TYPE_OPTIONS = [
    { value: "string", label: "string" },
    { value: "number", label: "number" },
    { value: "json",   label: "json" }
]

// Parâmetros do endpoint: tabela do kit (DataTable) + uma linha de criação com
// os controles do kit. Antes era <Table> do Semantic com Select estilizado por
// styled-components.
const TableParameters = ({parameters, onChangeParameters}:any) => {

    const [newName, setNewName]         = useState("")
    const [newIn, setNewIn]             = useState("")
    const [newType, setNewType]         = useState("")
    const [newRequired, setNewRequired] = useState(false)

    const [parameterForUpdate, setParameterForUpdate] = useState<Array<any>>()

    useEffect(()=>{
        if(parameters)
            setParameterForUpdate(undefined)
    }, [parameters])

    useEffect(()=>{
        if(parameterForUpdate)
            onChangeParameters(parameterForUpdate)
    }, [parameterForUpdate])

    const isButtonDisable = () => !(newName && newIn && newType && newName!=="" && newIn!=="" && newType!=="")

    const handleAddParameters = () => {

        setParameterForUpdate([...(parameterForUpdate || parameters), {
            name     : newName,
            in       : newIn,
            type     : newType,
            required : newRequired
        }])

        setNewName("")
        setNewIn("")
        setNewType("")
        setNewRequired(false)
    }

    const handleRemoveParameter = (index:number) => {
        const params = (parameterForUpdate || parameters)
        setParameterForUpdate(params.filter((_:any, position:number) => position !== index))
    }

    const rows = (parameterForUpdate || parameters).map((parameter:any, index:number) => ({ ...parameter, index }))

    return <Panel title="parameters" icon="list">
        <DataTable
            dense
            rows         = {rows}
            rowKey       = {(row:any) => String(row.index)}
            emptyMessage = "Nenhum parâmetro declarado."
            columns      = {[
                { key: "name", header: "name", mono: true },
                { key: "in",   header: "in" },
                { key: "type", header: "type" },
                {
                    key: "required",
                    header: "required",
                    align: "center",
                    width: 90,
                    render: (row:any) => row.required ? <Icon name="check" tone="success"/> : null
                },
                {
                    key: "actions",
                    header: "",
                    width: 50,
                    align: "right",
                    render: (row:any) =>
                        <IconButton
                            icon="minus"
                            label="remover parâmetro"
                            size="sm"
                            variant="danger"
                            onClick={() => handleRemoveParameter(row.index)}/>
                }
            ]}/>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", minWidth: 140 }}>
                <TextInput
                    placeholder = "name"
                    value       = {newName}
                    onChange    = {({target:{value}}:any) => setNewName(value)}/>
            </div>
            <div style={{ width: 120 }}>
                <SelectInput
                    placeholder = "in"
                    value       = {newIn}
                    options     = {IN_OPTIONS}
                    onChange    = {({target:{value}}:any) => setNewIn(value)}/>
            </div>
            <div style={{ width: 120 }}>
                <SelectInput
                    placeholder = "type"
                    value       = {newType}
                    options     = {TYPE_OPTIONS}
                    onChange    = {({target:{value}}:any) => setNewType(value)}/>
            </div>
            <CheckboxInput
                label    = "required"
                checked  = {newRequired}
                onChange = {({target:{checked}}:any) => setNewRequired(checked)}/>
            <Button
                variant  = "primary"
                icon     = "plus"
                disabled = {isButtonDisable()}
                onClick  = {handleAddParameters}/>
        </div>
    </Panel>
}

export default TableParameters
