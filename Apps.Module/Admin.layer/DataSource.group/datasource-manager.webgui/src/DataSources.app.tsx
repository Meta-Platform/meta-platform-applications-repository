import * as React from "react"
import {useEffect} from "react"
import { Dimmer, Loader}      from "semantic-ui-react"
import { Route, HashRouter }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import axios                  from "axios"

import HTTPServerManagerActionsCreator from "./Actions/HTTPServerManager.actionsCreator"


import PageMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

const fetchHTTPServersRunning = async () => {
    // @ts-ignore
    const {data} = await axios.get(process.env.HTTP_SERVER_MANAGER_ENDPOINT)
    return data
}


const DataSourceApp = ({HTTPServerManager, SetHTTPServersRunning}:any) => {

	useEffect(()=>{
        fetchHTTPServersRunning()
        .then(webServersRunning => SetHTTPServersRunning(webServersRunning))
    }, [])

	const handleRenderContainer = (container:any) => 
		(routeProps: any) =>
			React.createElement(container, {
				route:routeProps
			}, null)
    
	return HTTPServerManager.list_web_servers_running.length > 0 
			? <HashRouter>{
					ROUTES_CONFIG.map(({path, page}:{
						path:string,
						page:string
					}, key:number)=>
							<Route 
								key    = {key}
								path   = {path}
								//@ts-ignore
								render = {handleRenderContainer(PageMapper[page])} />)
					}</HashRouter>
					: <Dimmer active>
							<Loader>loading web services running...</Loader>
						</Dimmer>
	
}
		

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    SetHTTPServersRunning : HTTPServerManagerActionsCreator.SetHTTPServersRunning
}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
    HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(DataSourceApp)