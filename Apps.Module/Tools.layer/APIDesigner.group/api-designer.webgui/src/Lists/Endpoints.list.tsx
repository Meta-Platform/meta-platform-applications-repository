import * as React from "react"
import { 
	List, 
	Label, 
	Input, 
	Icon 
} from "semantic-ui-react" 
import styled from "styled-components"

const IconStyle = styled(Icon)`
	margin-left:15px!important;
`

const GetColorByMethod = (method:string) => {
	switch(method){
		case "GET":
			return "blue"
		case "POST":
			return "green"
		case "PUT":
			return "orange"		
		case "WS":
				return "olive"	
		case "DELETE":
			return "red"
		default:
			return "grey"
	}
}

const EndpointsList = ({endpoint, endpointSelected, onChangeSummary}:any) => 
	<List divided selection>
		{
			endpoint.map(
				({method, summary, path}:any, key:any) =>
				 <List.Item 
				 	key     = {key}
				 	active  = {endpointSelected.summary===summary}
					onClick = {()=>onChangeSummary(key)}>
					<List.Content>
							<Label color={GetColorByMethod(method)} horizontal>
								{method || "NONE"}
							</Label>
							<strong>{summary}</strong>
							{!path && <IconStyle title="URL is undefined" color="orange" name="warning sign"/>}
					</List.Content>
				</List.Item> )
		}
	</List>
  
export default EndpointsList
