import * as React             from "react"
import {useEffect}            from "react"
import { LoadingOverlay }     from "@i-components"
//@ts-ignore
import { Routes, BrowserRouter, HashRouter, Route }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import { HTTPServerManagerActionsCreator } from "@i-components"
import { FetchWebServersRunning } from "@i-components/net"

type AppContainerProps  = {
	routesConfig: any
	mapper: any
	HTTPServerManager : any
	SetHTTPServersRunning : Function
}

type RouteConfigType = {
	path:string,
	page:string
}

const GetRouteObject = (routesConfig:any[], mapper:any) =>  
	routesConfig.map(({path, page}:RouteConfigType) => {
		const Component = mapper[page]
		return {path, element:<Component/>}
	})

interface AppRoutesProps {
	routesConfig:any[]
	mapper:any
}

const AppRoutes = ({routesConfig, mapper}:AppRoutesProps) => {
	const routesObject = GetRouteObject(routesConfig, mapper)
	//const routes = useRoutes(routesObject)
	console.log(routesObject)
	return 
}

const AppContainer = ({
	routesConfig,
	mapper,
	HTTPServerManager, 
	SetHTTPServersRunning
}:AppContainerProps) => {

	// `ipcServices: "manifest"`: no GUI-host do Electron a lista é sintetizada a
	// partir de window.metaGui.getManifest(), no MESMO shape do HTTP
	// (listServices[].apiTemplate) — o GetRequestByServer precisa dele para
	// resolver cada endpoint e distinguir WS de HTTP.
	useEffect(()=>{
        FetchWebServersRunning({ ipcServices: "manifest" })
        .then(webServersRunning => SetHTTPServersRunning(webServersRunning))
    }, [])
	
	return HTTPServerManager.list_web_servers_running.length > 0 
		? <HashRouter>
				<Routes>
				{
					GetRouteObject(routesConfig, mapper)
					.map(({ path, exact, element }:any, key) => <Route key={key}{...{ path, element }}/>)
				}
				</Routes>
			</HashRouter>
		: <LoadingOverlay message="carregando serviços web em execução…"/>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    SetHTTPServersRunning : HTTPServerManagerActionsCreator.SetHTTPServersRunning
}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
    HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)
