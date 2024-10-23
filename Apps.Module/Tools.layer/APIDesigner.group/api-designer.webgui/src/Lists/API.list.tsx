import * as React from "react"
import { List } from "semantic-ui-react"

const APIList = (
	{APISelected, listAPI, onChangeAPI}
	:{APISelected:string, listAPI:Array<string>, onChangeAPI:Function}
) => 
<List selection animated>
	{
		listAPI.map((API, key) => 
		<List.Item 
			key     = {key}
			active  = {API===APISelected}
			onClick = {()=>onChangeAPI(API)}>
			<List.Icon name="globe" />
			<List.Content>
				<List.Header>{API}</List.Header>
			</List.Content>
		</List.Item>)
	}
</List>

export default APIList