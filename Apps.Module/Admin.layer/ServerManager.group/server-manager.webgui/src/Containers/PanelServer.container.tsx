import React                 from "react"
import {useEffect, useState} from "react"
import { 
	Menu,
    Segment,
    Card, 
    List,
    Label,
    Tab
 } from "semantic-ui-react"

import styled from "styled-components"

const getIndexTab = (panes:Array<any>, tabName:string) =>
	panes.indexOf(panes.find(({menuItem}) => menuItem === tabName))

const CardStyle = styled(Card)`
    width: fit-content!important;
    height: fit-content;
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

const PanelServerContainer = ({
    status, 
    queryParams,
    addQueryParam
}:any) =>{

    const [serverNameSelected, setServerNameSelected] = useState<string>()

    useEffect(() => {
		if(serverNameSelected){
            addQueryParam("server", serverNameSelected)
		}
	}, [serverNameSelected])

    const panes = 
        status 
        ? status.map(({name, port, listServices}:any, key:any) => ({
                menuItem: name + ":" + port,
                render: () => 
                        <Tab.Pane>
                            <Card.Group>
                                {    
                                    listServices
                                    .map(({
                                        serviceName, 
                                        type, 
                                        path, 
                                        apiTemplate, 
                                        summariesNotFound
                                    }:any, key:number) => 
                                        <CardStyle key={key}>
                                            <Card.Content>
                                                <strong>{
                                                    type.replace("Web", "")
                                                    .replace("APIEndpoints", "API Endpoints")
                                                    .replace("StaticEndpoints", "Static Endpoints")
                                                }</strong>
                                                <br/>{serviceName && serviceName.replace("Web", "")
                                                }
                                                <Card.Meta>{path}</Card.Meta>
                                                {
                                                    apiTemplate
                                                    && <List divided relaxed>
                                                    {
                                                        apiTemplate
                                                        .endpoints.map(({summary, path, method, parameters}:any, key:any) =>
                                                            <List.Item key={key} style={summariesNotFound.indexOf(summary) > -1 ?{backgroundColor: "#ffe1e1"}:{}}>
                                                            
                                                                <List.Content>
                                                                    <List.Header style={summariesNotFound.indexOf(summary) > -1 ?{color:"#FF0000"}:{}}>{summary}(<strong>{
                                                                        parameters 
                                                                        ? `{${parameters.map(({name}:any) => name).join(", ")}}`
                                                                        : ""})</strong></List.Header>
                                                                    <List.Description>
                                                                        <Label size="tiny" color={GetColorByMethod(method)} horizontal>
                                                                            {method || "NONE"}
                                                                        </Label>
                                                                        {path}
                                                                    </List.Description>
                                                                </List.Content>
                                                            </List.Item>)
                                                    }
                                                    </List>
                                                }
                                            </Card.Content>
                                        </CardStyle>)
                                }
                            </Card.Group>
                        </Tab.Pane>
            }))
        : []

    useEffect(() => {
        if(!queryParams.server && panes && panes.length > 0) 
            setServerNameSelected(panes[0].menuItem)
    }, [queryParams.server, panes])

    return <Tab
                activeIndex = {getIndexTab(panes, queryParams.server || serverNameSelected)} 
                menu        = {{ secondary: true, pointing: true }} 
                panes       = {panes} 
                onTabChange = {(event:any, data:any) => setServerNameSelected(panes[data.activeIndex].menuItem)}/>
}

export default PanelServerContainer