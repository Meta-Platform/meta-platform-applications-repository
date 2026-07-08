import React, { Fragment } from "react"

import {
    Input,
    Table,
    Form,
    Segment
} from "semantic-ui-react"


const GetUniqueProperties = (arrayOfObjects) => {
    const uniqueProperties = new Set()

    arrayOfObjects.forEach(obj => {
        Object.keys(obj).forEach(key => {
            uniqueProperties.add(key)
        })
    })

    return Array.from(uniqueProperties)
}

const ParamsViewer = ({ params }) => {

    const renderArrayItem = (arrayOfObjects) => {

        const columns = GetUniqueProperties(arrayOfObjects)

        return <Segment secondary style={{
            margin: "8px", 
            padding: "8px", 
            boxShadow: "rgb(92 92 92) 1px 1px 3px 1px"
            }}>
                    <Table celled striped compact>
                        <Table.Header>
                            <Table.Row>
                                {
                                    columns
                                    .map((property:string, key) => 
                                        <Table.HeaderCell key={key} style={{padding:"5px"}}>{property}</Table.HeaderCell>)
                                }
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {
                                arrayOfObjects.map((object, key) => 
                                <Table.Row key={key}>
                                    {
                                        columns
                                        .map((columnName:string) => 
                                            <Table.Cell key={columnName}>
                                                <Input
                                                    fluid
                                                    value={object[columnName]}/>
                                            </Table.Cell>)
                                    }
                                </Table.Row>)
                            }
                        </Table.Body>
                    </Table>
                </Segment>
    }

    const renderItemParam = (paramName, value) => 
        <Fragment>
            <Form.Field>
                <label style={{marginBottom:"0px"}}>{paramName}</label>
                {   
                    typeof value === "string" 
                    && <input 
                            placeholder={paramName} 
                            value={value}/>
                }
                {
                    !(typeof value === "string") 
                    && !Array.isArray(value) 
                    && renderParams(value)
                }
                {Array.isArray(value) && renderArrayItem(value)}
            </Form.Field>
        </Fragment>


    const renderParams = (params) => 
        <Segment style={{margin: "8px", padding:"8px", boxShadow: "rgb(92 92 92) 1px 1px 3px 1px", backgroundColor: "aliceblue"}}>
            <Form size="tiny">
                {
                    Object
                    .keys(params)
                    .map((property) => {
                        const itemValue = params[property]
                        return renderItemParam(property, itemValue)
                    })
                }
            </Form>
        </Segment>

    return <Fragment>
                {
                    params
                    && renderParams(params)
                }
            </Fragment>
}

export default ParamsViewer