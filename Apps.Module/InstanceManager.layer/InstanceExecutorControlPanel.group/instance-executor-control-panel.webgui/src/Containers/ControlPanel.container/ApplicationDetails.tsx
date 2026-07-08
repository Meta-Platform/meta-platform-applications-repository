import React, { useEffect, useState } from "react"

import { 
    Button, 
    Label, 
    Segment,
    Tab,
    TabPane
} from "semantic-ui-react"


const GetColorByStatus = (status) => {
	switch(status){
		case "ACTIVE":
			return "green"
		case "FAILURE":
			return "red"
		case "STARTING":
			return "blue"
		case "AWAITING_PRECONDITIONS":
			return "teal"
		default:
			return "orange"
	}
}

import HeaderDetails from "../../Components/HeaderDetails"

import GetAPI from "../../Utils/GetAPI"

import ParamsViewer from "../../Components/ParamsViewer"

const TaskTreeView = ({
    taskTree
}) => {

    const panes = [
        {
          menuItem: 'static parameters',
          render: () => <TabPane style={{padding:"0px"}}>
            <div style={{ overflow: 'auto', maxHeight:"47vh"}}>
                <ParamsViewer 
                    params={taskTree.task.staticParameters}/>
            </div>
                
          </TabPane>
        },
        {
            menuItem: 'child taks',
            render: () => <TabPane>
                  
            </TabPane>
          }
    ]

    return <>
            {
                taskTree
                && <Segment style={{backgroundColor: "#f4f4f4"}}>
				    <strong>Main Task ID {taskTree.task.taskId}</strong> | <i>{taskTree.task.objectLoaderType}</i>
				    <Label color={GetColorByStatus(taskTree.task.status)} size="mini" style={{marginRight: "5px"}}>{taskTree.task.status}</Label>
                    <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
			    </Segment>
            }
            </>
}


const ApplicationDetails = ({
    packageInformation, 
    serverManagerInformation,
    onClose
}) => {

    const {
        applicationInServiceState
    } = packageInformation

    const [ applicationTaskTree, setApplicationTaskTree ] = useState<any>()

    useEffect(() => {
        fetchTaskTree()
    }, [])


    const getTaskMonitorAPI = () => 
		GetAPI({ apiName:"TaskExecutorMonitor",  serverManagerInformation })


    const fetchTaskTree = async () => {
        const { data } = await getTaskMonitorAPI()
        .GetTaskTreeById({taskId:applicationInServiceState.taskId})
        setApplicationTaskTree(data)
    }

    const panes = [
        {
          menuItem: 'startup params',
          render: () => <TabPane>
                                {
                                    applicationInServiceState
                                    ?.staticParameters
                                    ?.startupParams
                                    && <div style={{ overflow: 'auto', maxHeight:"62vh"}}>
                                            <ParamsViewer 
                                                params={applicationInServiceState?.staticParameters?.startupParams} />
                                        </div>
                                }
                        </TabPane>,
        },
        {
          menuItem: 'task tree',
          render: () => <TabPane>
                                <TaskTreeView taskTree={applicationTaskTree}/>
                        </TabPane>,
        }
    ]
      
    return <Segment style={{backgroundColor: "#f4f4f4"}}>
        <Button 
            circular 
            icon='close' 
            floated="right"
            onClick={() => onClose()}
            />
        
        {
            packageInformation?.packageInService
            && packageInformation?.applicationInServiceState?.status === "ACTIVE"
            && <Label size="small" color="green" attached='top left'>ACTIVE</Label>
        }
        {
            packageInformation?.packageInService
            && packageInformation?.applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
            && <Label size="small" color="orange" attached='top left'> IN SERVICE</Label>
        }
        <HeaderDetails 
            serverManagerInformation={serverManagerInformation} 
            packageInformation={packageInformation}/>
        
        <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
    </Segment>
}

export default ApplicationDetails