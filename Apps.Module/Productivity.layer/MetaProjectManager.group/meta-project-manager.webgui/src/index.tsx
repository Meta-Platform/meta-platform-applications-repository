import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "@uiw/react-md-editor/markdown-editor.css"
import "@i-components/styles/index.css"
import "./Styles/mpm.css"

import { applySavedTheme } from "@i-components/theme"
import { applySavedZoom } from "./Utils/zoom"

// O Meta Project Manager abre em grayscale; se o usuário já escolheu outro tema,
// a escolha dele manda (ver Utils/theme.ts).
// Aplica tema e zoom antes do render, para não piscar.
applySavedTheme()
applySavedZoom()

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
	<AppContainer
		routesConfig = {ROUTES_CONFIG}
		mapper = {PagesMapper}/>
</Provider>)
