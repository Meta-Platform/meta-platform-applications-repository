import * as React from "react"
import {List} from "semantic-ui-react"


const WebServiceDetails = ({webService:{serviceName, apiTemplate}}:any) => {

    return <>
                <h3>{serviceName}</h3>
                <List divided selection>
                    {
                        apiTemplate.endpoints.map(({summary, parameters}:any, key:any) => 
                        <List.Item key={key}>
                            <List.Content>{summary}(<strong>{
                                parameters 
                                ? `{${parameters.map(({name}:any) => name).join(", ")}}`
                                : ""})</strong></List.Content>
                        </List.Item>)
                    }
                </List>
            </>
}


export default WebServiceDetails