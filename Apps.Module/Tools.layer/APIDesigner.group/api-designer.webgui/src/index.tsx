import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "semantic-ui-css/semantic.css"
import "@i-components/styles/index.css"
import { applySavedTheme } from "@i-components/theme"

//import APIDesignerIcon from "./APIDesigner.svg"
//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import AppContainer             from "./Containers/App.container"
import { AppManagerReducer, HTTPServerManagerReducer, ProcessManagerReducer } from "@i-components"

import PagesMapper from "./Mappers/Pages.mapper"

const reducer = combineReducers({
	AppManager        : AppManagerReducer,
	HTTPServerManager : HTTPServerManagerReducer,
	ProcessManager    : ProcessManagerReducer
})

const store = createStore(reducer)

applySavedTheme()
const root = ReactDOM.createRoot(document.getElementById("gui"))

root.render(<Provider store={store}>
	<AppContainer
		routesConfig = {ROUTES_CONFIG}
		mapper       = {PagesMapper}/>
</Provider>)
