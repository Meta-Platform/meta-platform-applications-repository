
import * as React from "react"
import {List} from "semantic-ui-react"

const WorkspacesList = ({selected, list, onSelect}:any) => 
<List selection animated>
	{
		list.map((workspace:string, key:any) => 
		<List.Item key={key} active={selected===workspace} onClick={()=>onSelect(workspace)}>
			<List.Icon name={selected===workspace ? "folder open" : "folder"} />
			<List.Content>
				<List.Header>{workspace}</List.Header>
			</List.Content>
		</List.Item>)
	}
</List>

export default WorkspacesList