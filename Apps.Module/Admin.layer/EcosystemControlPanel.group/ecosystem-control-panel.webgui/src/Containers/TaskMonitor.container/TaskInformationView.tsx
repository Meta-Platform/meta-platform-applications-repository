import * as React from "react"
import { useState, useEffect } from "react"
import { 
	Segment, 
	Loader, 
	Header,
	Label,
	Tab,
	TabPane,
	Form,
	Divider,
	FormGroup,
	FormField,
	Input,
	Select
 } from 'semantic-ui-react'


import GetAPI from "../../Utils/GetAPI"
import ParamsViewer from "../../Components/ParamsViewer"

import AgentLinkRulesView from "./AgentLinkRulesView"
import RuleView from "./RuleView"

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

const ActivationRulesView = ({rules}) => {
	return <>
	{
		Object.keys(rules)
		.map((logicOperator) => <RuleView logicOperator={logicOperator} expressions={rules[logicOperator]}/>)
	}
	</>
}

const TaskInformationView = ({
	taskId,
	serverManagerInformation
}) => {

	const [ taskInformation, setTaskInformation ] = useState<any>()

	useEffect(() => {
		fetchTaskInformation()
	}, [taskId])

	const getTaskMonitorAPI = () => 
		GetAPI({ apiName:"TaskExecutorMonitor", serverManagerInformation })

	const fetchTaskInformation = async () => {
		setTaskInformation(undefined)
        try {
            const api = getTaskMonitorAPI()
            const response = await api.GetTaskInformation({taskId})
            const taskInformation = response.data
            setTaskInformation(taskInformation)

        }catch(e){
            console.log(e)
        }
    }

	const panes = [
		...taskInformation?.staticParameters
			? [{
				menuItem: 'static parameters',
				render: () => <TabPane style={{padding:"5px"}}>
					<div style={{ overflow: 'auto', maxHeight:"64vh"}}>
						<ParamsViewer 
							params={taskInformation.staticParameters}/>
					</div>
				</TabPane>,
			  }]
			: [],
		...taskInformation?.linkedParameters
			  ? [{
				menuItem: 'linked parameters',
				render: () => <TabPane style={{padding:"5px"}}>
					<div style={{ overflow: 'auto', maxHeight:"62vh"}}>
						<ParamsViewer 
							params={taskInformation.linkedParameters}/>
					</div>
					
				</TabPane>,
			  }]
			  : [],
		...taskInformation?.agentLinkRules
			? [{
				menuItem: 'agent link rules',
				render: () => <TabPane>
					<div style={{ overflow: 'auto', maxHeight:"62vh"}}>
						<AgentLinkRulesView
							linkRules={taskInformation.agentLinkRules}
						/>
					</div>
				</TabPane>,
			  }]
			: [],
		...taskInformation?.activationRules
			? [{
				menuItem: 'activation rules',
				render: () => <TabPane>
					<div style={{ overflow: 'auto', maxHeight:"62vh"}}>
						<ActivationRulesView rules={taskInformation?.activationRules}/>
					</div>
				</TabPane>,
			}]
			: [],
		...taskInformation?.hasChildTasks
			? [{
				menuItem: 'children',
				render: () => <TabPane></TabPane>,
			}]
			: []
    ]

	return <Segment style={{backgroundColor: "#f4f4f4"}}>
				<Header as='h2' textAlign='center'>
					{
						taskInformation
						&& <Header.Content>
								Task ID {taskId}
								<Label color={GetColorByStatus(taskInformation.status)}>{taskInformation.status}</Label>
								{ 
									taskInformation.pTaskId !== undefined 
									&& <Label>Parent Task ID{taskInformation.pTaskId}</Label>
								}
								<Header.Subheader>
									{taskInformation.objectLoaderType}
								</Header.Subheader>
							</Header.Content>
					}
				</Header>
				{!taskInformation && <Loader active />}
				<Tab menu={{ secondary: true, pointing: true }} panes={panes} />
			</Segment>
}

export default TaskInformationView