import * as React from "react"
import { Table }  from "semantic-ui-react"


type ColumnConfigType = {
    property?   : string
    label?     : string
    formatter? : Function
}

type DataTableProps = {
    config:Array<ColumnConfigType>
    list:Array<any>
}

const getValue = ({ property, formatter}: ColumnConfigType, row: any, key:number) => {
    if (formatter && property) {
        return formatter(row[property], key)
    } else if (property) {
        return row[property]
    } else if (formatter) {
        return formatter(row, key)
    }
}

const DataTable = ({
    config,
    list
}:DataTableProps) => {

    return <Table size="small" compact="very">
                <Table.Header>
                    <Table.Row>
                        {
                            config
                            .map(({label}:any, key:number) => 
                                <Table.HeaderCell key={key}>{label}</Table.HeaderCell>
                            )
                        }
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {
                        (list || [])
                        .map((row:any, key:number) => 
                            <Table.Row key={key}>
                                {
                                    config
                                    .map((configColumn, key) => 
                                    <Table.Cell key={key}>
                                        {getValue(configColumn, row, key)}
                                    </Table.Cell>)
                                }
                            </Table.Row>
                        )
                    }
                </Table.Body>
            </Table>
}
   


export default DataTable