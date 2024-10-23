import * as React                       from "react"
import ReactDOM                         from "react-dom/client"
import { Provider }                     from "react-redux"
import { combineReducers, createStore } from "redux"

import "semantic-ui-css/semantic.css"

import PagesMapper from "./Mappers/Pages.mapper"

//@ts-ignore
import ROUTES_CONFIG from "./routes.config.json"

import AppContainer             from "./Containers/App.container"
import HTTPServerManagerReducer from "./Reducers/HTTPServerManager.reducer"

import PackageManagerReducer from "./Reducers/PackageManager.reducer"
import QueryParamsReducer    from "./Reducers/QueryParams.reducer"


const reducer = combineReducers({
	HTTPServerManager : HTTPServerManagerReducer,
	PackageManager    : PackageManagerReducer,
	QueryParams       :  QueryParamsReducer
})

const store = createStore(reducer)
const root = ReactDOM.createRoot(document.getElementById("gui"))
 
root.render(
	<Provider store={store}>
		<AppContainer
			routesConfig = {ROUTES_CONFIG}
			mapper = {PagesMapper}/>
	</Provider>)