import * as React from "react"
import { ListRow } from "@i-components"

const APIList = (
	{APISelected, listAPI, onChangeAPI}
	:{APISelected:string, listAPI:Array<string>, onChangeAPI:Function}
) =>
<div>
	{
		listAPI.map((API, key) =>
			<ListRow
				key      = {key}
				icon     = "globe"
				title    = {API}
				selected = {API === APISelected}
				onClick  = {() => onChangeAPI(API)}/>)
	}
</div>

export default APIList
