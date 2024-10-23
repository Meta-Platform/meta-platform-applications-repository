import * as React from "react"
import {
    Button, 
    Icon,
    Header
} from "semantic-ui-react"

import styled from "styled-components"

import SourceList from "../Lists/Source.list"

const ButtonStyled = styled(Button)`
    margin-left: 5px!important;
`

type SourceColumnProps = {
    selected : string
    list : Array<SourceType>
    onSelect : Function
}

const SourceColumn = ({
    selected,
    list,
    onSelect
}:SourceColumnProps) => {
    return <> 
                <h3>
                    Sources
                    <ButtonStyled 
                        icon 
                        size="mini" 
                        color="blue" 
                        title ="New Source"
                        onClick = {() => {}}>
                        <Icon name="plus" />
                    </ButtonStyled>
                </h3>
                <Header dividing as="h4">Ready</Header>
                <SourceList 
                    selected={selected}
                    list={list.filter(({status})=> status.toUpperCase() === "READY")} 
                    onSelect={onSelect}/>
                <Header dividing as="h4">With Error</Header>
                <SourceList 
                    selected={selected}
                    list={list.filter(({status})=> status.toUpperCase() === "ERROR")} 
                    onSelect={onSelect}/>
            </>
}

export default SourceColumn