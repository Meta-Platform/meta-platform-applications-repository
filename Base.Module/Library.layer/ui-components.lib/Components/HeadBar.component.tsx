
import React from "react"
import { 
    Menu, 
    Image, 
    Button, 
    Header, 
    Label
} from "semantic-ui-react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import ProcessManagerActionsCreator from "../Actions/ProcessManager.actionsCreator"

const HeadBarComponent = ({
    title,
    items,
    ProcessManager,
    OpenModalProcessManager
}:any) =>{

    const {list_process} = ProcessManager

    const handleClose = () => {
        window.location.href = "/"
    }

    return <>
                <Menu attached="top">
                    {
                        title &&
                        <Menu.Item>
                            <Header>{title}</Header>
                        </Menu.Item>
                    }
                    {items}
                    {
                        list_process.length > 0 
                        && <Menu.Item 
                            active
                            onClick={OpenModalProcessManager}>
                                <Image spaced="right" src={/*TerminalIcon*/""} size="mini"/>
                                <strong>Process Manager</strong>
                                <Label circular color="orange">{list_process.length}</Label>
                        </Menu.Item>
                    }
                    {/*
                        title !== "Home" 
                        && <Menu.Item position="right">
                            <Button color="orange" icon="close" onClick={handleClose}/>
                        </Menu.Item>
                    */}
                </Menu>
            </>
}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    OpenModalProcessManager  : ProcessManagerActionsCreator.OpenModal,
}, dispatch)

const mapStateToProps = ({ProcessManager}:any) => ({
	ProcessManager
})
export default connect(mapStateToProps, mapDispatchToProps)(HeadBarComponent)