import * as React              from "react"
import { useEffect, useState } from "react"
import styled                  from "styled-components"
import { connect }             from "react-redux"
import { Container, Grid}      from "semantic-ui-react"

import { bindActionCreators } from "redux"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import SidebarMenu from "../Components/SidebarMenu"

const Column = Grid.Column

import TaskMonitor from "../Containers/TaskMonitor.container"
import ControlPanelContainer from "../Containers/ControlPanel.container"
import PackageExplorerContainer from "../Containers/PackageExplorer.container"
import RepositoriesContainer from "../Containers/Repositories.container"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const ControlPanelPage = ({ 
	HTTPServerManager, 
	QueryParams,
	AddQueryParam,
	SetQueryParams
}:any) => {


	const [ activeItem, setActiveItem ] = useState<string>()

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
		}
	}, [])

	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])

	useEffect(() => {
		if(activeItem){
			AddQueryParam("panel", activeItem)
		} else if(!activeItem && queryParams.panel){
			setActiveItem(queryParams.panel as string)
		} else {
			setActiveItem("packages")
		}

	}, [activeItem])


	const handleSelectMenu = (activeItem) => setActiveItem(activeItem)

	return <Container fluid={true}>
				<Grid>
					<Column  style={{width:"auto", paddingRight:0}}>
						<SidebarMenu 
							title="Ecosystem Panel" 
							onSelectMenu={handleSelectMenu}
							activeItem={activeItem}/>
					</Column>
					<Column style={{width:"auto", paddingLeft:0}}>
						{
							activeItem === "packages"
							&& <PackageExplorerContainer serverManagerInformation={HTTPServerManager}/>
						}
						{
							activeItem === "environments"
							&& <ControlPanelContainer serverManagerInformation={HTTPServerManager}/>
						}
						{
							activeItem === "task executor monitor"
							&& <TaskMonitor />
						}
						{
							activeItem === "repositories"
							&& <RepositoriesContainer serverManagerInformation={HTTPServerManager}/>
						}
					</Column>
				</Grid>
		</Container>
}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam,
	SetQueryParams : QueryParamsActionsCreator.SetQueryParams
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelPage)