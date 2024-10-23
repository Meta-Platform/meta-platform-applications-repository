
import React from "react"
import {useState, useEffect}  from "react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"

import {Grid, Table} from "semantic-ui-react"

const LogTable = (log:Array<LogType>) => {

    return 
}

type LogsProps = {
    PackageManager:any
}

const Logs = ({
    PackageManager
}:LogsProps) =>{

    return  <Table>
                <Table.Header>
                    <Table.Row>
                        <Table.HeaderCell>Timestamp</Table.HeaderCell>
                        <Table.HeaderCell>Data</Table.HeaderCell>
                    </Table.Row>
                </Table.Header>
            </Table>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager, QueryParams}:any) => ({
    PackageManager,
    QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(Logs)