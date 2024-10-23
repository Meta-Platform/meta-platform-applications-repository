import * as React from "react"

import {
	Message,
	Input
} from "semantic-ui-react"

import APIList    from "../Lists/API.list"

const APIColumn = ({
    onChangeAPIForCreate,
    onChangeAPI,
    APISelected,
    listAPI,
    APIForCreate,
    onCreateAPI,
    errorMessage}:any) => {
    return <>
        <h3>API</h3>
		<APIList
			onChangeAPI = {onChangeAPI}
			APISelected = {APISelected}
		 	listAPI     = {listAPI}/>
		<Input
			value       = {APIForCreate}
			placeholder = "web service name"
			onChange    = {({target:{value}}) => onChangeAPIForCreate(value)}
			action      = {{
				disabled : !(APIForCreate && APIForCreate !== ""),
				icon     : "add" , 
				color    : "blue",
				onClick  : onCreateAPI
			}}/>

		{
			errorMessage 
			&& <Message negative>
					<p>{errorMessage}</p>
				</Message>
		}
    </>
}

export default APIColumn