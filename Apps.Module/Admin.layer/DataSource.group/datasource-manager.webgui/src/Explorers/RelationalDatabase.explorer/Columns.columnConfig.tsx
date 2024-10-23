import React from "react"
import {Input, Checkbox} from "semantic-ui-react"
import styled from "styled-components"

const InputW100Stlyed = styled(Input)`
    width:100%;
`

export default [
    {
        property : "columnName",
        label    : "Column Name",
        formatter : (columnName:string) => <InputW100Stlyed value={columnName}/>
    },
    {
        property : "type",
        label    : "Type"
    },
    {
        property  : "primaryKey",
        label     : "PK",
        formatter : (primaryKey:boolean) => <Checkbox checked={primaryKey}/>
    },
    {
        property : "allowNull",
        label    : "NN",
        formatter : (allowNull:boolean) => <Checkbox checked={!allowNull}/>
    },
    {
        property : "autoIncrement",
        label    : "AI",
        formatter : (autoIncrement:boolean) => <Checkbox checked={autoIncrement}/>
    },
    {
        property : "defaultValue",
        label    : "Default"
    }
]