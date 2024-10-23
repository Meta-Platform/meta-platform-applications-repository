import * as React             from "react"
import { Tab, Loader }        from "semantic-ui-react"
import { useEffect, useState} from "react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"

import FileSystemExplorer from "../Explorers/FileSystem.explorer"
import PackageConfigExplorer from "../Explorers/PackageConfig.explorer"

import WEBAPP_PACKAGE_EXPLORER_CONFIGS from "../Configs/PackageExplorers/Webapp.config"
import WEBSERVICE_EXPLORER_CONFIGS from "../Configs/PackageExplorers/Webservice.config"
import WEBGUI_EXPLORER_CONFIGS from "../Configs/PackageExplorers/Webgui.config"
import LIBRARY_EXPLORER_CONFIGS from "../Configs/PackageExplorers/Library.config"

import QueryParamsActionsCreator    from "../Actions/QueryParams.actionsCreator"

const getIndexTab = (panes:Array<any>, tabName:string) =>
	panes.indexOf(panes.find(({menuItem}) => menuItem === tabName))

type TabExplorerProps = {
	packageSelected   : {name:string, ext:string}
	workspace         : string
	PackageManager    : any
	QueryParams       : any
	AddQueryParam     : Function
	RemoveQueryParam  : Function
}

const TabExplorer = ({
    packageSelected,
	workspace,
	PackageManager,
	QueryParams,
	AddQueryParam,
	RemoveQueryParam
}:TabExplorerProps) => {

	const [tabNameSelected, setTabNameSelected] = useState<string>()

    useEffect(() => {
		
		if(QueryParams.explorer && QueryParams.explorer !== ""){
			setTabNameSelected(QueryParams.explorer)
		}else if(tabPanes[0]){
			setTabNameSelected(tabPanes[0].menuItem)
		}
	}, [PackageManager.package_details])

	useEffect(() => {
		if(tabNameSelected){
			AddQueryParam("explorer", tabNameSelected)
		}
	}, [tabNameSelected])

	//TODO deixar dinâmico
	const tabPanes = (PackageManager.package_details && PackageManager.package_details.verifications )
	? [
		{
			keystone: "WEBAPP_PACKAGE_EXPLORER",
			menuItem: "Webapp Components",
			render: () => 
				<Tab.Pane>
					<PackageConfigExplorer
						configs={WEBAPP_PACKAGE_EXPLORER_CONFIGS}
						data={{packageSelected, workspace}}/>
				</Tab.Pane>
		},
        {
			keystone: "WEBGUI_PACKAGE_EXPLORER",
			menuItem: "Webgui Components",
			render: () => 
				<Tab.Pane>
					<PackageConfigExplorer
						configs={WEBGUI_EXPLORER_CONFIGS}
						data={{packageSelected, workspace}}/>
				</Tab.Pane>
		},
		{
			keystone: "WEBSERVICE_PACKAGE_EXPLORER",
			menuItem: "Webservice Components",
			render: () => 
				<Tab.Pane>
					<PackageConfigExplorer
						configs={WEBSERVICE_EXPLORER_CONFIGS}
						data={{packageSelected, workspace}}/>
				</Tab.Pane>
		},
		{
			keystone: "LIBRARY_PACKAGE_EXPLORER",
			menuItem: "Library Components",
			render: () => 
				<Tab.Pane>
					<PackageConfigExplorer
						configs={LIBRARY_EXPLORER_CONFIGS}
						data={{packageSelected, workspace}}/>
				</Tab.Pane>
		},
		{
			keystone: "FILESYSTEM_PAGKAGE_NAVIGATOR",
			menuItem: "File System",
			render: () => 
				<Tab.Pane>
					<FileSystemExplorer
						packageSelected = {packageSelected}
						workspace = {workspace}/>
				</Tab.Pane>
		}
	]
	.filter(({keystone}) => {
		if(keystone === "FILESYSTEM_PAGKAGE_NAVIGATOR") return true
		const {
			package_details:{
				verifications
			}
		} = PackageManager

		if ((keystone === "WEBGUI_PACKAGE_EXPLORER" && verifications.WebguiExt)   
		|| (keystone === "WEBSERVICE_PACKAGE_EXPLORER" && verifications.WebserviceExt)
		|| (keystone === "LIBRARY_PACKAGE_EXPLORER" && verifications.LibraryExt) 
		|| (keystone === "WEBAPP_PACKAGE_EXPLORER" && verifications.WebappExt))
		{
			return true
		}else {
			return false
		}
	})
	: []

	const handleChangeTab = (event:any, data:any) =>{
		RemoveQueryParam("module")
		RemoveQueryParam("endpointName")
		RemoveQueryParam("item")
		setTabNameSelected(
			//@ts-ignore
			tabPanes[data.activeIndex].menuItem
		)
	}

	return  PackageManager.package_details
	? <Tab 
				activeIndex = {getIndexTab(tabPanes, tabNameSelected)} 
				menu        = {{ secondary: true, pointing: true }} 
				panes       = {tabPanes} 
				onTabChange = {handleChangeTab}/>
	:  <Loader active inline="centered" />
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam    : QueryParamsActionsCreator.AddQueryParam,
	RemoveQueryParam :  QueryParamsActionsCreator.RemoveQueryParam
}, dispatch)

const mapStateToProps = ({PackageManager, QueryParams}:any) => ({
	PackageManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(TabExplorer)
