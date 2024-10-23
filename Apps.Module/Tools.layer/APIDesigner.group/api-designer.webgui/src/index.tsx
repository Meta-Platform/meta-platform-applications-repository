import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "semantic-ui-css/semantic.css"

//import APIDesignerIcon from "./APIDesigner.svg"
//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import AppContainer             from "./Containers/App.container"
import AppManagerReducer        from "./Reducers/AppManager.reducer"
import HTTPServerManagerReducer from "./Reducers/HTTPServerManager.reducer"
import ProcessManagerReducer    from "./Reducers/ProcessManager.reducer"

import PagesMapper from "./Mappers/Pages.mapper"

const reducer = combineReducers({
	AppManager        : AppManagerReducer,
	HTTPServerManager : HTTPServerManagerReducer,
	ProcessManager    : ProcessManagerReducer
})

const store = createStore(reducer)

const root = ReactDOM.createRoot(document.getElementById("gui"))

root.render(<Provider store={store}>
	<AppContainer
		routesConfig = {ROUTES_CONFIG}
		mapper       = {PagesMapper}/>
</Provider>)