import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "@i-components/styles/index.css"
import "./Styles/workspace.css"

import { applySavedTheme } from "@i-components/theme"

applySavedTheme()

import PagesMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import { AppManagerReducer, HTTPServerManagerReducer, ProcessManagerReducer, QueryParamsReducer } from "@i-components"
import AppContainer             from "./Containers/App.container"

const reducer = combineReducers({
	AppManager        : AppManagerReducer,
	HTTPServerManager : HTTPServerManagerReducer,
	ProcessManager    : ProcessManagerReducer,
	QueryParams       : QueryParamsReducer
})

const store = createStore(reducer)

const root = ReactDOM.createRoot(document.getElementById("gui"))

root.render(<Provider store={store}>
	<AppContainer routesConfig={ROUTES_CONFIG} mapper={PagesMapper}/>
</Provider>)
