import * as React from "react"
import { useState } from "react"
import { Grid, Segment} from 'semantic-ui-react'
import { connect } from "react-redux"
import { bindActionCreators } from "redux"

import useWebSocket from "../../Hooks/useWebSocket"
import GetAPI from "../../Utils/GetAPI"

import TaskItem from "./TaskItem"
import TaskInformationView from "./TaskInformationView"

const TaskMonitorContainer = ({
	HTTPServerManager
}:any) => {

	const [ monitoringState, setMonitoringState ] = useState([])

	const [ taskIdDetailsSelected, setTaskIdDetailsSelected ] = useState<number>()

	const getTaskMonitorAPI = () => 
		GetAPI({ apiName:"TaskExecutorMonitor", serverManagerInformation: HTTPServerManager })

	useWebSocket({
		socket          : getTaskMonitorAPI().MonitoringState,
		onMessage       : (message) => setMonitoringState(message),
		onConnection    : () => updateMonitoringState(),
		onDisconnection : () => setMonitoringState([])
	})

	const updateMonitoringState = () => {
		getTaskMonitorAPI()
		.GetMonitoringState()
		.then(({data}:any) => setMonitoringState(data))
	}

	const handleShowTaskDetails = (taskId) => setTaskIdDetailsSelected(taskId)

	return <Grid style={{padding:"1em"}}>
				<Grid.Column width={taskIdDetailsSelected!==undefined ? 8 : 16}>
					<div style={{ overflow: 'auto', maxHeight:"87vh" }}>
					{
						monitoringState
						.map((task, index) =>
							<TaskItem 
								key={index} 
								index={index} 
								task={task}
								onShowTaskDetails={handleShowTaskDetails}/>)
					}
					</div>
				</Grid.Column>
				{
					taskIdDetailsSelected!==undefined
					&& <Grid.Column width={8}>
							<TaskInformationView 
								serverManagerInformation={HTTPServerManager}
								taskId={taskIdDetailsSelected}/>
						</Grid.Column>
				}
			</Grid>
}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager
})

export default connect(mapStateToProps, mapDispatchToProps)(TaskMonitorContainer)