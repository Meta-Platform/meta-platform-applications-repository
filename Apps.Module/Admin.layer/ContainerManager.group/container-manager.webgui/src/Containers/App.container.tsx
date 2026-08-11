import * as React             from "react"
import {useEffect}            from "react"
//@ts-ignore
import { Routes, BrowserRouter, HashRouter, Route }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import { HTTPServerManagerActionsCreator, LoadingOverlay } from "@i-components"
import { FetchWebServersRunning } from "@i-components/net"

// `ipcServices: "manifest"` porque no modo janela (Electron GUI-host) não há
// servidor HTTP: a lista de webservices é sintetizada a partir do manifesto (o
// api.json de cada controller). É o manifesto que permite ao GetRequestByServer
// distinguir WS de HTTP — sem ele o aplicativo ficaria sem log ao vivo, sem
// terminal e sem métricas.
const fetchHTTPServersRunning = () => FetchWebServersRunning({ ipcServices: "manifest" })

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

	useEffect(()=>{
        fetchHTTPServersRunning()
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
		: <LoadingOverlay message="Carregando serviços em execução…"/>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    SetHTTPServersRunning : HTTPServerManagerActionsCreator.SetHTTPServersRunning
}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
    HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)
