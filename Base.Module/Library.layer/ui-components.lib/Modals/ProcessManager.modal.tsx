import * as React             from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"



import ProcessManagerActionsCreator from "../Actions/ProcessManager.actionsCreator"
import TerminalComponent from "../Components/Terminal.component"

import { 
	Modal,
    Table,
    Tab
} from "semantic-ui-react"

const ProcessManagerModal = ({
    ProcessManager, 
    CloseModalProcessManager, 
    HTTPServerManager
}:any) =>{

    const {list_process, modal_is_open} = ProcessManager
    //GetRequestByServer(HTTPServerManager)("Web", keystone)


    
    const panes = [
        {
            menuItem: "Process",
        render: () => 
            <Tab.Pane>
                <Table celled padded>
                        <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>PID</Table.HeaderCell>
                            <Table.HeaderCell>Command</Table.HeaderCell>
                            <Table.HeaderCell>Current Working Directory</Table.HeaderCell>
                        </Table.Row>
                        </Table.Header>

                        <Table.Body>
                            {
                                list_process 
                                && list_process
                                .map(({pid, cmd, cwd}:any, key:any) => 
                                    <Table.Row key={key}>
                                        <Table.Cell>{pid}</Table.Cell>
                                        <Table.Cell>{cmd}</Table.Cell>
                                        <Table.Cell>{cwd}</Table.Cell>
                                    </Table.Row>)
                            }
                        </Table.Body>
                    </Table>
            </Tab.Pane> 
        },
        
        ...Array.from(Array(list_process.length)
        .keys())
        .map((key)=>({
            menuItem: { 
                key: list_process[key].pid, 
                icon: "terminal", 
                content: list_process[key].pid 
            }, 
			render: () => 
                <Tab.Pane>
                    <TerminalComponent pid={list_process[key].pid}/>
                </Tab.Pane>
        }))
      ]


    return <Modal dimmer="blurring" open={modal_is_open} onClose={CloseModalProcessManager}>
                <Modal.Header>Process Manager</Modal.Header>
                <Modal.Content>
                <Tab panes={panes}/>
               
                </Modal.Content>
            </Modal>
}


const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    CloseModalProcessManager : ProcessManagerActionsCreator.CloseModal
}, dispatch)

const mapStateToProps = ({ProcessManager, HTTPServerManager}:any) => ({
    ProcessManager,
    HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(ProcessManagerModal)
