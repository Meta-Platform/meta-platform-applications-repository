import * as React                   from "react"
import { useEffect, useState}       from "react"
import { connect }                  from "react-redux"
import { bindActionCreators }       from "redux"

import { 
	Container,
	Grid,
	Tab
 } from "semantic-ui-react"

import GlobalStyle          from "../Styles/Global.style"
import GetRequestByServer   from "../Utils/GetRequestByServer"

import WebServiceDetails    from "../Components/WebServiceDetails.component"
import ServerList           from "../List/Server.list"
import PanelServerContainer from "../Containers/PanelServer.container"

const getIndexTab = (panes:Array<any>, tabName:string) =>
	panes.indexOf(panes.find(({menuItem}) => menuItem === tabName))

const HTTPServersContainer = ({
	queryParams,
	onChangeQueryParams,
	HTTPServerManager
}:any) => {

	const [webServersRequest, setRequest] = useState()
	const [status, setStatus]             = useState()

	const [webserverSelected, setWebserverSelected]   = useState()
	const [webserviceSelected, setWebserviceSelected] = useState()

	const [tabNameSelected, setTabNameSelected] = useState<string>()

	useEffect(() => setRequest(GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "HTTPServers")), [])
	
	useEffect(() => updateStatus(), [webServersRequest])

	useEffect(() => {
		if(tabNameSelected){
			onChangeQueryParams({
				...queryParams, 
				tab:tabNameSelected
			})
		}
	}, [tabNameSelected])

	const updateStatus = () => {
		if(webServersRequest){
			GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "HTTPServers")
			.Status()
			.then(({data}:any) => setStatus(data))
		}
	}

	const webServiceSelected = 
		status
		&& webserverSelected
		&& webserviceSelected
		&& (status || [])
		//@ts-ignore
			.find(({name}:any) => webserverSelected === name)
			.listServices
			.find(({apiTemplate}:any) => apiTemplate && webserviceSelected === apiTemplate.name)

	const panes =
	[
		{ 
			menuItem: "Status", 
			render: () => 
				<Tab.Pane>
					<PanelServerContainer 
						status              = {status}
						queryParams         = {queryParams}
						onChangeQueryParams = {onChangeQueryParams}/>
				</Tab.Pane>
		},
		{
			menuItem: "Handle",
			render: () => 
				<Tab.Pane>
					<Grid columns="three" divided>
						<Grid.Row>
							<Grid.Column width={3}>
								<ServerList 
									selected={{webserver:webserverSelected, webservice:webserviceSelected}}
									list={status || []}
									onSelectHTTPServer={()=>{}}
									onSelectService={({webservice, webserver}:any)=>{
										setWebserverSelected(webserver)
										setWebserviceSelected(webservice)
									}}/>
							</Grid.Column>
							<Grid.Column width={5}>
								{webServiceSelected && <WebServiceDetails webService={webServiceSelected}/>}
							</Grid.Column>
						</Grid.Row>
					</Grid>
				</Tab.Pane> 
		}
	]

	useEffect(() => {
		if(!queryParams.tab && panes && panes.length > 0) 
			setTabNameSelected(panes[0].menuItem)
	}, [queryParams.tab])

	return <Container fluid={true}>
				<GlobalStyle />
				<div>
						<Tab 
							activeIndex = {getIndexTab(panes, queryParams.tab || tabNameSelected)} 
							menu  		= {{ secondary: true, pointing: true }} 
							onTabChange = {(event:any, data:any) => setTabNameSelected(panes[data.activeIndex].menuItem)}
							panes 		= {panes} />
				</div>
			</Container>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({

}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
	HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(HTTPServersContainer)

