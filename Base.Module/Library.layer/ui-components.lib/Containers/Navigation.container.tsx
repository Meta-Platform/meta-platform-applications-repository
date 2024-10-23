import * as React             from "react"
import {useEffect, useState}  from "react"
import axios                  from "axios"
import { Route, HashRouter }  from "react-router-dom"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Dimmer, Loader}      from "semantic-ui-react"

import HTTPServerManagerActionsCreator from "../Actions/HTTPServerManager.actionsCreator"

import ProcessManagerModal from "../Modals/ProcessManager.modal"
/*
const fetchHTTPServersRunning = async () => {
    // @ts-ignore
    const {data} = await axios.get(process.env.HTTP_SERVER_MANAGER_ENDPOINT)
    return data
}
*/
const fetchHTTPServersRunning = async (httpServerManagerEndpoint:string) => {
    const {data} = await axios.get(httpServerManagerEndpoint)
    return data
}

const NavigationContainer = ({
    keystone,
    container,
    icon,
    label,
    HTTPServerManager, 
    SetHTTPServersRunning
}:any) => {


    useEffect(()=>{
        // @ts-ignore
        fetchHTTPServersRunning(process.env.HTTP_SERVER_MANAGER_ENDPOINT)
        .then(webServersRunning => SetHTTPServersRunning(webServersRunning))
        .catch((e) => {

            console.log(e)
        })
    }, [])


    const handleRenderContainer = 
        ({keystone, container, icon, label}:any) =>
        (routeProps: any) =>
            React.createElement(container, {keystone, icon, label, route:routeProps}, null)

    return  HTTPServerManager.list_web_servers_running.length > 0 
            ? <HashRouter>
                <Route
                    path="/" 
                    render={handleRenderContainer({
                        keystone,
                        container, 
                        icon, 
                        label 
                    })} />
                <ProcessManagerModal/>
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
export default connect(mapStateToProps, mapDispatchToProps)(NavigationContainer)
