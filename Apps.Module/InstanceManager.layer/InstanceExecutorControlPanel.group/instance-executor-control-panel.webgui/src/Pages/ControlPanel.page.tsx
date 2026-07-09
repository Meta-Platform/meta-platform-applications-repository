import * as React              from "react"
import { useEffect, useState } from "react"
import { connect }             from "react-redux"

import { bindActionCreators } from "redux"
import qs                     from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import TopMenu, { MENU_ITEMS, DEFAULT_MENU_ITEM } from "../Components/TopMenu"

import TaskMonitor from "../Containers/TaskMonitor.container"
import LauncherContainer from "../Containers/Launcher.container"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

// Painéis antigos que ainda podem estar salvos numa URL/bookmark. "packages" e
// "repositories" foram fundidos no Launcher; "instances" e "terminal" saíram (o
// que está no ar aparece no monitor, e o terminal vive na aba do pacote CLI).
const LEGACY_PANEL_ALIAS:any = {
	"packages"              : "launcher",
	"repositories"          : "launcher",
	"terminal"              : "launcher",
	"environments"          : "monitor",
	"instances"             : "monitor",
	"task executor monitor" : "monitor"
}

const IsKnownPanel = (panel:string) => MENU_ITEMS.some(({ name }) => name === panel)

const ResolvePanel = (panel?:string) => {
	if(!panel) return DEFAULT_MENU_ITEM
	if(IsKnownPanel(panel)) return panel
	return LEGACY_PANEL_ALIAS[panel] || DEFAULT_MENU_ITEM
}

const ControlPanelPage = ({
	HTTPServerManager,
	QueryParams,
	AddQueryParam,
	SetQueryParams
}:any) => {

	const [ activeItem, setActiveItem ] = useState<string>()

	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
		}
	}, [])

	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])

	useEffect(() => {
		if(activeItem){
			AddQueryParam("panel", activeItem)
		} else {
			setActiveItem(ResolvePanel(queryParams.panel as string))
		}
	}, [activeItem])

	const handleSelectMenu = (menuItem:string) => setActiveItem(menuItem)

	const renderActivePanel = () => {
		switch(activeItem){
			case "launcher":
				return <LauncherContainer serverManagerInformation={HTTPServerManager}/>
			case "monitor":
			default:
				return <TaskMonitor/>
		}
	}

	// A topbar (.eco-main-menu) é `position: fixed` no design system, então sai do
	// fluxo. O shell `.eco-control-body` reserva a altura dela via padding-top —
	// sem isso o conteúdo passa por baixo da barra.
	return <div className="eco-control-shell">
			<TopMenu
				activeItem={activeItem}
				onSelectMenu={handleSelectMenu}/>
			<div className="eco-control-body" style={{ height: "100vh", boxSizing: "border-box", overflow: "hidden" }}>
				{ activeItem && renderActivePanel() }
			</div>
		</div>
}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam,
	SetQueryParams : QueryParamsActionsCreator.SetQueryParams
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelPage)
