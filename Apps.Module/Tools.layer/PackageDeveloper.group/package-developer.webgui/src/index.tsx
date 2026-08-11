import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "@i-components/styles/index.css"
import "./Styles/workbench.css"
import "./Styles/explorer.css"
import "./Styles/ide.css"
import "./Styles/components.css"

import { applySavedTheme } from "@i-components/theme"

import PagesMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import AppContainer             from "./Containers/App.container"
import { HTTPServerManagerReducer, QueryParamsReducer } from "@i-components"

import PackageManagerReducer from "./Reducers/PackageManager.reducer"


const reducer = combineReducers({
	HTTPServerManager : HTTPServerManagerReducer,
	PackageManager    : PackageManagerReducer,
	QueryParams       :  QueryParamsReducer
})

applySavedTheme()

const store = createStore(reducer)
const root = ReactDOM.createRoot(document.getElementById("gui"))
 
root.render(
	<Provider store={store}>
		<AppContainer
			routesConfig = {ROUTES_CONFIG}
			mapper = {PagesMapper}/>
	</Provider>)
