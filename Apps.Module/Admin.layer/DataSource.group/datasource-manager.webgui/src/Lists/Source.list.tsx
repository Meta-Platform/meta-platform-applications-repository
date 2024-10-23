
import * as React from "react"
import {List, Label, Image} from "semantic-ui-react"


import datastoreIcon from "../Assets/datastore.svg"
import fileSystemIcon from "../Assets/file-system.svg"
import databaseIcon from "../Assets/database.svg"

import styled from "styled-components"

const ICON:any = {
	"fs":fileSystemIcon,
	"relational-database":databaseIcon,
	"datastore":datastoreIcon
}

const LabelWithMarginLeft = styled(Label)`
    margin-left: 5px!important;
`

const GetColorByStatus = (status:string) => {
	switch(status){
		case "PENDING":
			return "grey"
		case "WAITING":
			return "olive"
		case "READY":
			return "green"	
		case "ERROR":
			return "red"
		default:
			return "grey"
	}
}

const SourceList = ({selected, list, onSelect}:any) => 
<List selection animated>
	{
		list.map(({
			keystone, 
			name, 
			type, 
			status, 
			message
		}:SourceType, key:any) => 
		<List.Item key={key} 
			active={selected===keystone}
			onClick={()=> onSelect(keystone)}>
            <Image size="mini" src={ICON[type]}/>
			<List.Content>
				<List.Header>{name}
                     <LabelWithMarginLeft size="mini" title={message} color={GetColorByStatus(status)} horizontal>
					    {status}
                        </LabelWithMarginLeft>
                </List.Header>
                <List.Description>{type}</List.Description>
			</List.Content>
		</List.Item>)
	}
</List>

export default SourceList