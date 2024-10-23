
import * as React from "react"

import {List} from "semantic-ui-react"

type ListProps =
{
	list               : Array<any>
	selected           : any
	onSelectHTTPServer : Function
	onSelectService    : Function
}

const ServerList = ({list, selected, onSelectHTTPServer, onSelectService}:ListProps) => {
	return <List selection animated>
				{
					list.map(({name, listServices, port}:any, key:number) => 
					<List.Item 
					    onClick={() => onSelectHTTPServer(name)}
						key={key} > 
						<List.Icon name="globe" />
						<List.Content>
							<List.Header>{name}</List.Header>
							{port}
							<List.List>
								
								{
									listServices.map(({apiTemplate, path, staticDir}:any, key:any) => 
									<List.Item 
										title={staticDir}
										key={key} 
										active={apiTemplate && selected.webservice === apiTemplate.name && selected.webserver === name }
										onClick={() => onSelectService({webservice:apiTemplate.name, webserver:name})}>
										<List.Icon name="folder" />
										<List.Content>
											{apiTemplate && <List.Header>{apiTemplate.name}</List.Header>}
											{!apiTemplate && <List.Content>{path}</List.Content>}
										</List.Content>
									</List.Item>)
								}
							</List.List>
						</List.Content>
					</List.Item>)
				}
			</List>
}


export default ServerList