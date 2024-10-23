import * as React from "react"
import {useState, useEffect} from "react"
import {
    Button, 
    Segment, 
    Table,
    Icon,
    Form,
    Header,
    Loader,
    Divider
} from "semantic-ui-react"

import styled from "styled-components"

import  WorkspaceModal from "../Modals/Workspace.modal"


import WorkspacesList from "../Lists/Workspaces.list"


const ButtonStyled = styled(Button)`
    margin-left: 5px!important;
`

type WorkspaceColumnProps = {
    selected : string
    list     : Array<any>
    onSelect : Function
}

const WorkspaceColumn = ({
    selected,
    list,
    onSelect
}:WorkspaceColumnProps) => {

    const [isWorkspaceModalOpen, setWorkspaceModal] = useState(false)


    const closeWorkspaceModal = () => setWorkspaceModal(false)
    const openWorkspaceModal  = () => setWorkspaceModal(true)

    return <> 
                <h3>
                    Workspaces
                    <ButtonStyled 
                        icon 
                        size="mini" 
                        color="blue" 
                        title ="Add Workspace"
                        onClick = {() => openWorkspaceModal()}>
                        <Icon name="plus" />
                    </ButtonStyled>
                </h3>
                
                <WorkspacesList
                    selected = {selected}
                    list     = {list}
                    onSelect = {onSelect}/>
                
                <WorkspaceModal open={isWorkspaceModalOpen} onClose={()=> closeWorkspaceModal()}/>
            </>
}

export default WorkspaceColumn