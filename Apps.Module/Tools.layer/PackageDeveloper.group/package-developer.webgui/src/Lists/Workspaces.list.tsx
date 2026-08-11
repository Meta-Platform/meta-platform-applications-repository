
import * as React from "react"
import { ListRow } from "@i-components"

const WorkspacesList = ({selected, list, onSelect}:any) =>
<div role="list">
	{
		list.map((workspace:string, key:any) =>
		<ListRow key={key}
			icon={selected===workspace ? "folder open" : "folder"}
			title={workspace}
			selected={selected===workspace}
			onClick={()=>onSelect(workspace)} />)
	}
</div>

export default WorkspacesList
