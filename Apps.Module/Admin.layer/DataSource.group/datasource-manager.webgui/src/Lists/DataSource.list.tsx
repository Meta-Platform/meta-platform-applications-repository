
import * as React from "react"
import {Fragment} from "react"

import {List, Label} from "semantic-ui-react"


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

const SourceList = ({list, selected, onSelect}:any) =><List selection animated>
{
	list.map(({type, name, status, message, dialect, filename}:any, key:any) => 
	<List.Item 
		key={key} 
		disabled = {status === "ERROR"}
		active={selected && selected.type===type && selected.name===name} 
	onClick={()=>onSelect({type, name})}>
		<List.Icon name="database" />
		<List.Content>
			<List.Header>
				{name+" "}
				<Label size="mini" title={message} color={GetColorByStatus(status)} horizontal>
					{status}
				</Label>
			</List.Header>
			{dialect || filename}
		</List.Content>
	</List.Item>)
}
</List>


const getTypeName = (type:string) => {
	switch(type){
		case "relational-database":
			return "Relational Database"
		case "fs":
			return "File System"
		case "datastore":
			return "Data Store"
		default:
			return "Undefined"

	}
}

const DataSourceList = ({selected, list, onSelect}:any) => {

	const sourcesByType = list.reduce((acc:any, source:any)=>{

		if(acc[source.type]){
			acc[source.type].push(source)
		}else{
			acc[source.type] = [source]
		}
		return acc
	}, {})

	return <>
		
		{
			Object.keys(sourcesByType)
			.map((type, key) => 
			<Fragment key={key}>
				<h4>{getTypeName(type)}</h4>
				<SourceList list={sourcesByType[type]} selected={selected} onSelect={onSelect}/>
			</Fragment>)
		}
	</>

}

export default DataSourceList