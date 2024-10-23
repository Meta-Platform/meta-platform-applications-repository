import * as React              from "react"
import { useEffect, useState } from "react"
import { connect }             from "react-redux"
import {Grid, Tab}             from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"

import ColumnEditor from "./RelationalDatabase.explorer/ColumnEditor"
import TableList    from "./RelationalDatabase.explorer/Table.list"
import useTableState from "./RelationalDatabase.explorer/useTableState"


const getIndexTab = (panes:Array<any>, tabName:string) =>
    panes.indexOf(panes.find(({menuItem}) => menuItem === tabName))
    
const RelationalDatabaseExplorer = ({source, HTTPServerManager}:any) =>{

    
    const [resultAllTables, setResultAllTables] = useState([])
    const [tableSelected, setTableSelected]     = useState()

    const [tabNameSelected, setTabNameSelected] = useState<string>()

    const {listFieldDescription} = useTableState({
        HTTPServerManager,
        //@ts-ignore
        keystone:(source || {}).keystone,
        tableName:tableSelected
    })

    useEffect(() => {
        //@ts-ignore
        if(source && source.status === "READY"){
            showAllTables()
        }
    }, [source])

    const showAllTables = () =>{
        setResultAllTables([])
        setTableSelected(undefined)
        GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "RelacionalDatabaseHandler")
        //@ts-ignore
        .ShowAllTableName({ keystone : source.keystone })
        .then(({ data }: any) => setResultAllTables(data))
    }

    const handleChangeTab = (event:any, data:any) =>{
		setTabNameSelected(
			//@ts-ignore
			panes[data.activeIndex].menuItem
		)
    }


    const panes = tableSelected 
    ? [
        {
            menuItem:"Data",
            render: () =>
                <Tab.Pane>
    
                </Tab.Pane>
        },
        {
            menuItem:"Columns",
            render: () =>
                <Tab.Pane>
                    <ColumnEditor listFieldDescription={listFieldDescription}/>
                </Tab.Pane>
        }
    ]
    : []

    return <div style={{marginTop:"15px"}}>
                <Grid divided>
                    <Grid.Row>
                        <Grid.Column width={3}>
                            <TableList 
                                list     = {resultAllTables}
                                selected = {tableSelected}
                                onSelect = {setTableSelected}/>	
                        </Grid.Column>
                        <Grid.Column width={13}>
                            {/*
                                tableSelected 
                                && <TableEditor
                                        keystone = {
                                            //@ts-ignore
                                            source.keystone} 
                                        tableName = {tableSelected}/>
                                        */}
                            <Tab 
                                activeIndex = {getIndexTab(panes, tabNameSelected)} 
                                menu        = {{ secondary: true, pointing: true }} 
                                panes       = {panes} 
                                onTabChange = {handleChangeTab}/>
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </div>
}
    
const mapStateToProps = ({ HTTPServerManager }: any) => ({
    HTTPServerManager
})

export default connect(mapStateToProps, (dispatch) => ({}))(RelationalDatabaseExplorer)