import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

// Design system Meta Platform "Retro-Brutalist" (mesmo dos outros painéis).
import "@i-components/styles/index.css"
import "@instance-components/styles/index.css"
import "./Styles/launcher.css"

import { applySavedTheme } from "@i-components/theme"

import PagesMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import { AppManagerReducer, HTTPServerManagerReducer, ProcessManagerReducer, QueryParamsReducer } from "@i-components"

import AppContainer             from "./Containers/App.container"

const reducer = combineReducers({
	AppManager        : AppManagerReducer,
	HTTPServerManager : HTTPServerManagerReducer,
	ProcessManager    : ProcessManagerReducer,
	QueryParams       :  QueryParamsReducer
})

const store = createStore(reducer)

// aplica o tema salvo (data-theme no <html>) antes do render
applySavedTheme()

const root = ReactDOM.createRoot(document.getElementById("gui"))

root.render(<Provider store={store}>
	{/*//TODO trocar para App.container */}
	<AppContainer
		routesConfig = {ROUTES_CONFIG}
		mapper = {PagesMapper}/>
</Provider>)
