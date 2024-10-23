import * as React from "react"
import {useState, useEffect} from "react"
import styled from "styled-components"

import { 
    Checkbox,
    Table,
    Icon,
    Input,
    Select,
    Button
} from "semantic-ui-react"


const SelectStyle = styled(Select)`
    min-width: 100px!important;
`

const inOptions = [
    { key: "body", value: "body", text: "body" },
    {key: "path", value: "path", text: "path" },
    { key: "query", value: "query", text: "query" }
  ]

  const typeOptions = [
    { key: "string", value: "string", text: "string" },
    { key: "number", value: "number", text: "number" },
    { key: "json", value: "json", text: "json" }
  ]

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

    const handleRemoveParameter = (key:any) => {
        const params = (parameterForUpdate || parameters)
        setParameterForUpdate(params.reduce((acc:any, value:any, index:any)=>{
            return key !== index ? [...acc, value] : acc
        }, []))
    }

    return <Table celled striped>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell colSpan="5">parameters</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>name</Table.HeaderCell>
                        <Table.HeaderCell>in</Table.HeaderCell>
                        <Table.HeaderCell>type</Table.HeaderCell>
                        <Table.HeaderCell>required</Table.HeaderCell>
                        <Table.HeaderCell/>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {
                        (parameterForUpdate || parameters).map((parameter: any, key:number) =>
                            <Table.Row key={key}>
                                {
                                    ["name", "in", "type"]
                                        .map((property, key2) => <Table.Cell key={key2}>{parameter[property]}</Table.Cell>)
                                }
                                <Table.Cell>{parameter.required && <Icon name="check"/>}</Table.Cell>
                                <Table.Cell>
                                    <Button color="orange" icon="minus" onClick={() => handleRemoveParameter(key)}/>
                                </Table.Cell>
                            </Table.Row>)
                    }
                    <Table.Row>
                        <Table.Cell>
                            <Input
                                placeholder="name"
                                value={newName}
                                onChange={({target:{value}}) => setNewName(value)} />
                        </Table.Cell>
                        <Table.Cell>
                            <SelectStyle 
                                placeholder="in"
                                value={newIn}
                                options={inOptions}
                                onChange={(e:any, {value}:any) => setNewIn(value)} />
                        </Table.Cell>
                        <Table.Cell>
                            <SelectStyle
                                placeholder="type"
                                value={newType}
                                options={typeOptions}
                                onChange={(e:any, {value}:any) => setNewType(value)} />
                        </Table.Cell>
                        <Table.Cell>
                            <Checkbox 
                                checked={newRequired}
                                toggle
                                onChange={(e:any, {checked}:any) => setNewRequired(checked)}/>
                        </Table.Cell>
                        <Table.Cell>
                            <Button 
                                disabled = {isButtonDisable()} 
                                color    = "blue"
                                icon     = "plus"
                                onClick  = {handleAddParameters}/>
                        </Table.Cell>
                    </Table.Row>
                </Table.Body>
            </Table>
}
    





export default TableParameters