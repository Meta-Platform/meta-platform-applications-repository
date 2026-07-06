import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "semantic-ui-css/semantic.css"
import "./Styles/tokens.css"
import "./Styles/CorporateTheme.css"
import "./Styles/theme-retro-brutalist.css"
import "./Styles/components.css"
import "./Styles/themes.css"
import "./Styles/workspace.css"

import { applySavedTheme } from "./Utils/theme"

applySavedTheme()

import PagesMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import QueryParamsReducer       from "./Reducers/QueryParams.reducer"
import AppContainer             from "./Containers/App.container"
import AppManagerReducer        from "./Reducers/AppManager.reducer"
import HTTPServerManagerReducer from "./Reducers/HTTPServerManager.reducer"
import ProcessManagerReducer    from "./Reducers/ProcessManager.reducer"

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
