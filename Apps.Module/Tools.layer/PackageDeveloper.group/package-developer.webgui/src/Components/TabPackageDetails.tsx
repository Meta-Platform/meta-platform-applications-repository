import * as React             from "react"
import {useState, useEffect}  from "react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"
import {
    Tab,
    Segment, 
    Icon,
    Header,
    Loader,
    Divider
} from "semantic-ui-react"


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
				<Tab.Pane>
					<Functionalities
                        workspace         = {workspace}
                        hasNodeModulesDir = {hasNodeModulesDir}/>
				</Tab.Pane>
        }]
        :[],
        ...(package_details
            || ui_details
            || web_details
            || lib_details)
        ?[{
			menuItem: "NPM Scripts",
			render: () => 
				<Tab.Pane>
					<NPMScripts/>
				</Tab.Pane>
		}]
        :[],
        ...(package_details
            || ui_details
            || web_details
            || lib_details)
        ?[{
			menuItem: "Logs",
			render: () => 
				<Tab.Pane>
					<Logs/>
				</Tab.Pane>
		}]
        :[]
    ]

    useEffect(() => {
		if(panes[0] && !tabNameSelected){
			setTabNameSelected(panes[0].menuItem)
		}
	}, [panes])

    const getIndexTab = (panes:Array<any>, tabName:string) =>
    panes.indexOf(panes.find(({menuItem}) => menuItem === tabName))
    
    
    const handleChangeTab = (event:any, data:any) =>{
		setTabNameSelected(
			//@ts-ignore
			panes[data.activeIndex].menuItem
		)
	}

    return  <Tab 
                activeIndex = {getIndexTab(panes, tabNameSelected)} 
                menu        = {{ secondary: true, pointing: true }} 
                panes       = {panes} 
                onTabChange = {handleChangeTab}/>
}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager}:any) => ({
    PackageManager
})

export default connect(mapStateToProps, mapDispatchToProps)(TabPackageDetails)
