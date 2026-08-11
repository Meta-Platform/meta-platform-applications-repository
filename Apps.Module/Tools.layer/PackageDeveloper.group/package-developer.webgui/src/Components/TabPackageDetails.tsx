import * as React             from "react"
import {useState, useEffect}  from "react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"
import { Tabs, Surface } from "@i-components"


import Functionalities from "./Functionalities"
import NPMScripts      from "./NPMScripts"
import Logs            from "./Logs" 

type TabPackageDetailsProps = {
    workspace      : string
    PackageManager : any
}

const TabPackageDetails = ({
    workspace,
    PackageManager
}:TabPackageDetailsProps) => {

    const [tabNameSelected, setTabNameSelected] = useState<string>()

    const {
        package_details,
        ui_details,
        ui_routes,
        web_details,
        lib_details
    } = PackageManager || {}

    const {
        hasNodeModulesDir,
        hasUIDir,
        hasWebDir,
        hasLibDir,
        hasAppDataDir,
        hasBootFile
    } = package_details && package_details.verifications || {}
    
    const panes = [
        ...package_details
        && package_details.packageJson
        ? [{
			menuItem: "Functionalities",
			render: () =>
				<Functionalities
                    workspace         = {workspace}
                    hasNodeModulesDir = {hasNodeModulesDir}/>
        }]
        :[],
        ...(package_details
            || ui_details
            || web_details
            || lib_details)
        ?[{
			menuItem: "NPM Scripts",
			render: () => <NPMScripts/>
		}]
        :[],
        ...(package_details
            || ui_details
            || web_details
            || lib_details)
        ?[{
			menuItem: "Logs",
			render: () => <Logs/>
		}]
        :[]
    ]

    useEffect(() => {
		if(panes[0] && !tabNameSelected){
			setTabNameSelected(panes[0].menuItem)
		}
	}, [panes])

    const getPane = (panes:Array<any>, tabName:string) =>
    panes.find(({menuItem}) => menuItem === tabName)

    const handleChangeTab = (menuItem:string) => setTabNameSelected(menuItem)

    // `Tabs` do kit é só a barra: o painel ativo é renderizado aqui.
    const activePane = getPane(panes, tabNameSelected)

    return  <div style={{display:"flex", flexDirection:"column", minHeight:0}}>
                <div style={{flex:"0 0 auto"}}>
                    <Tabs
                        tabs      = {panes.map(({menuItem}) => ({ key: menuItem, label: menuItem }))}
                        activeKey = {tabNameSelected}
                        onChange  = {handleChangeTab}/>
                </div>
                {
                    activePane &&
                    <Surface style={{flex:1, minHeight:0, padding:"var(--mp-space-4)", overflow:"auto"}}>
                        {activePane.render()}
                    </Surface>
                }
            </div>
}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager}:any) => ({
    PackageManager
})

export default connect(mapStateToProps, mapDispatchToProps)(TabPackageDetails)
