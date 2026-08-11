import * as React             from "react"
import {useEffect}            from "react"
//@ts-ignore
import { Routes, BrowserRouter, HashRouter, Route }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import { HTTPServerManagerActionsCreator, LoadingOverlay } from "@i-components"
import { FetchWebServersRunning } from "@i-components/net"
import { EventsProvider } from "../Hooks/useEvents"
import { ToastProvider } from "../Hooks/useToasts"
import { ApprovalQueueProvider } from "../Hooks/useApprovalQueue"
import AgentActivityToasts from "../Components/AgentActivityToasts"
import { FeedbackProvider } from "../Hooks/useFeedback"
import { ReadOnlyProvider } from "../Hooks/useReadOnly"

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

	// `ipcServices: "empty"` (padrão): no GUI-host do Electron a lista é
	// sintetizada só para passar o portão de render — quem fala por IPC em modo
	// proxy não consulta o manifesto.
	useEffect(()=>{
        FetchWebServersRunning()
        .then(webServersRunning => SetHTTPServersRunning(webServersRunning))
    }, [])
	
	// Providers na RAIZ: o polling de eventos, os toasts e a fila de aprovação
	// precisam sobreviver à troca de rota — a aprovação prende um agente do outro
	// lado e não pode sumir porque o usuário navegou.
	return HTTPServerManager.list_web_servers_running.length > 0 
		? <HashRouter>
				<ReadOnlyProvider>
					<EventsProvider>
						<ToastProvider>
							<ApprovalQueueProvider>
								<FeedbackProvider>
									<AgentActivityToasts/>
									<Routes>
									{
										GetRouteObject(routesConfig, mapper)
										.map(({ path, exact, element }:any, key) => <Route key={key}{...{ path, element }}/>)
									}
									</Routes>
								</FeedbackProvider>
							</ApprovalQueueProvider>
						</ToastProvider>
					</EventsProvider>
				</ReadOnlyProvider>
			</HashRouter>
		: <LoadingOverlay message="carregando serviços web…"/>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    SetHTTPServersRunning : HTTPServerManagerActionsCreator.SetHTTPServersRunning
}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
    HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)
