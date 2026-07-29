import * as React from "react"
import { Icon, ListRow, StatusChip, Tooltip } from "@i-components"

// Tom do método HTTP. É específico do domínio de API, por isso mora aqui e não
// no kit — mas usa o StatusChip do kit, então o visual é o da plataforma.
export const GetToneByMethod = (method:string) => {
	switch(method){
		case "GET"    : return "info"
		case "POST"   : return "success"
		case "PUT"    : return "warning"
		case "WS"     : return "neutral"
		case "DELETE" : return "danger"
		default       : return "neutral"
	}
}

const EndpointsList = ({endpoint, endpointSelected, onChangeSummary}:any) =>
	<div>
		{
			endpoint.map(
				({method, summary, path}:any, key:any) =>
				<ListRow
					key      = {key}
					title    = {summary}
					selected = {endpointSelected.summary === summary}
					onClick  = {() => onChangeSummary(key)}
					meta     = {<StatusChip label={method || "NONE"} tone={GetToneByMethod(method)}/>}
					right    = {
						!path
						? <Tooltip content="path não definido"><Icon name="warning sign" tone="warning"/></Tooltip>
						: undefined
					}/>)
		}
	</div>

export default EndpointsList
