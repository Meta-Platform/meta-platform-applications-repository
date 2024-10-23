import * as React from "react"
import {
	Input,
	Button,
	Select
} from "semantic-ui-react"

import EndpointsList   from "../Lists/Endpoints.list"

const EndpointColumn = ({
    methodForCreate,
    endpointForCreate,
    endpointSelected, 
    listEndpoint,
    onCreateEndpoint,
    onChangeSummary,
    onChangeEndpointForCreate,
    onChangeMethodForCreate
    }:any) => {

    return <>
        <h3>Endpoints</h3>
		<EndpointsList
			endpointSelected = {endpointSelected || {}}
			endpoint         = {listEndpoint}
			onChangeSummary  = {onChangeSummary}/>
		<Input type="text" placeholder="endpoint name" action>
			<input 
				value       = {endpointForCreate}
				onChange    = {({target:{value}}) => onChangeEndpointForCreate(value)}/>
			<Select
				value={methodForCreate}
				compact
				onChange={onChangeMethodForCreate}
				options={[
					{ key: "GET",    text: "GET",    value: "GET" },
					{ key: "POST",   text: "POST",   value: "POST" },
					{ key: "PUT",    text: "PUT",    value: "PUT" },
					{ key: "DELETE", text: "DELETE", value: "DELETE" },
					{ key: "WS",     text: "WS",     value: "WS" }
			  	]}/>
			<Button 
				disabled = {!(endpointForCreate || endpointForCreate === "")}
				icon     = "add"
				color    = "blue"
				onClick  = {onCreateEndpoint}/>
		</Input>
    </>
}

export default EndpointColumn