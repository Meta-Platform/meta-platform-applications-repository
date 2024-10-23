import * as React from "react"

import TabExplorer from "../Components/TabExplorer"

type ExplorerColumnProps = {
	packageSelected : {name:string, ext:string}
	workspace : string
}

const ExplorerColumn = ({
    packageSelected,
	workspace
}:ExplorerColumnProps) => <> 
	<h3>Explorer</h3>
	<TabExplorer 
		packageSelected = {packageSelected}
		workspace = {workspace}/>
	</>

export default ExplorerColumn