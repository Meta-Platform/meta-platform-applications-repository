
import * as React from "react"
import {useEffect, useState} from "react"

import { Table } from "semantic-ui-react"


const DocumentTable = ({listDocuments}:any) => {

    const [listProperties, setProperties] = useState<Array<string>>()

    useEffect(() => {

        if(listDocuments){
            const listProperties = listDocuments
                .reduce((listProperties:Array<string>, doc:any)=>{
                    Object.keys(doc)
                    .forEach((property:string) => 
                        (listProperties.indexOf(property) === -1)
                        && listProperties.push(property)
                    )
        
                    return listProperties
                }, [])

            setProperties(listProperties)
        }
        

    }, [listDocuments])

    return <Table compact>
                <Table.Body>
                <Table.Row>
                    {
                    (listProperties || [])
                    .map((property:string, key:number) => 
                        <Table.Cell key={key}>{property}</Table.Cell>)
                    }
                </Table.Row>

                {
                    (listDocuments || [])
                    .map((document:any, keyRow:number) => 
                        <Table.Row key={keyRow}>   
                            {
                                (listProperties  || [])
                                .map((property:string, keyCell:number) => 
                                    <Table.Cell key={keyCell}>
                                        {
                                            typeof document[property] === "object"
                                            ? "[OBJECT]"
                                            : document[property]
                                        }
                                    </Table.Cell>)
                            }
                        </Table.Row>)
                }
                </Table.Body>
            </Table>
}
   


export default DocumentTable