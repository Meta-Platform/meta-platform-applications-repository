import * as React             from "react"
import {useEffect}            from "react"
import { Dimmer, Loader}      from "semantic-ui-react"
//@ts-ignore
import { Routes, BrowserRouter, HashRouter, Route }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import axios                  from "axios"

import HTTPServerManagerActionsCreator from "../Actions/HTTPServerManager.actionsCreator"

const fetchHTTPServersRunning = async () => {
    // Electron GUI-host: não há servidor HTTP — o transporte é IPC (window.metaGui).
    // Busca o manifesto (api.json por serviço) e monta um serverManagerInformation
    // sintético no MESMO shape do HTTP (list_web_servers_running[].listServices[]
    // com serviceName/apiTemplate), para o GetRequestByServer resolver cada
    // endpoint e distinguir WS de HTTP.
    if(typeof window !== "undefined" && (window as any).metaGui){
        const manifest = await (window as any).metaGui.getManifest()
        const listServices = Object.keys(manifest || {}).map((apiName:string) => ({
            serviceName: `${apiName}Controller`,
            path: "",
            apiTemplate: manifest[apiName]
        }))
        return [{ name: process.env.SERVER_APP_NAME, port: 0, listServices }]
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
	
	return HTTPServerManager.list_web_servers_running.length > 0 
		? <HashRouter>
				<Routes>
				{
					GetRouteObject(routesConfig, mapper)
					.map(({ path, exact, element }:any, key) => <Route key={key}{...{ path, element }}/>)
				}
				</Routes>
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