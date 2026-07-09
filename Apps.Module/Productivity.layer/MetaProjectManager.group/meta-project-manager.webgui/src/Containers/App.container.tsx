import * as React             from "react"
import {useEffect}            from "react"
import { Dimmer, Loader}      from "semantic-ui-react"
//@ts-ignore
import { Routes, BrowserRouter, HashRouter, Route }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import axios                  from "axios"

import HTTPServerManagerActionsCreator from "../Actions/HTTPServerManager.actionsCreator"
import { EventsProvider } from "../Hooks/useEvents"
import { ToastProvider } from "../Hooks/useToasts"
import { ApprovalQueueProvider } from "../Hooks/useApprovalQueue"
import AgentActivityToasts from "../Components/AgentActivityToasts"
import { FeedbackProvider } from "../Hooks/useFeedback"

const fetchHTTPServersRunning = async () => {
    // Electron GUI-host: não há servidor HTTP — o transporte é IPC (window.metaGui).
    // Sintetiza a LISTA de servidores (mesmo shape que o axios entrega: a própria
    // array, que o reducer guarda em list_web_servers_running) só para passar o
    // gate de render; o conteúdo não é consultado no caminho IPC.
    if(typeof window !== "undefined" && (window as any).metaGui){
        return [{ name: process.env.SERVER_APP_NAME, port: 0, listServices: [] }]
    }
    // @ts-ignore
    const {data} = await axios.get(process.env.HTTP_SERVER_MANAGER_ENDPOINT)
    return data
}

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
	
	// Providers na RAIZ: o polling de eventos, os toasts e a fila de aprovação
	// precisam sobreviver à troca de rota — a aprovação prende um agente do outro
	// lado e não pode sumir porque o usuário navegou.
	return HTTPServerManager.list_web_servers_running.length > 0 
		? <HashRouter>
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
			</HashRouter>
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
export default connect(mapStateToProps, mapDispatchToProps)(AppContainer)