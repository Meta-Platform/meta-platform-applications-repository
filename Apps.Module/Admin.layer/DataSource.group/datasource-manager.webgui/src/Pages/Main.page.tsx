import * as React             from "react"
import { useEffect, useState} from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Grid }              from "semantic-ui-react"

//@ts-ignore
import qs from "query-string"
import {
	useLocation,
	useNavigate
  } from "react-router-dom"

import GetRequestByServer from "../Utils/GetRequestByServer"

import ColumnLayout from "../Layouts/Column.layout"
import PageDefault from "../Components/PageDefault"

import QueryParamsActionsCreator    from "../Actions/QueryParams.actionsCreator"

import SourceColumn             from "../Columns/Source.column"
import RelationalDatabaseColumn from "../Columns/RelationalDatabase.column"
import DatastoreColumn          from "../Columns/Datastore.column"
import FileSystemColumn         from "../Columns/FileSystem.column"

const Column = Grid.Column

import useSourceState from "../Hooks/useSourceState"


const MainPage = ({
	HTTPServerManager,
	route,
	SetQueryParams,
	AddQueryParam,
	RemoveQueryParam,
	QueryParams
}:any) => {
	
	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

	const [dataSource, setDataSource] = useState<SourceType>()

	useEffect(() => {
		if(Object.keys(queryParams).length > 0){
			SetQueryParams(queryParams)
		}
	}, [])

	useEffect(() => {
		const search = qs.stringify(QueryParams)
		navigate({search: `?${search}`})
	}, [QueryParams])

	const {
        listSource,
        keystoneSelected,
		setKeystoneSelected,
		sourceSelected
	} = useSourceState({HTTPServerManager})

	useEffect(() => {
		if(QueryParams.source && QueryParams.source !== ""){
			setKeystoneSelected(QueryParams.source)
		}
	},  [listSource])

	useEffect(() => { 
		if(keystoneSelected){
			AddQueryParam("source", keystoneSelected)
		}else if(keystoneSelected === ""){
			RemoveQueryParam("source")
			RemoveQueryParam("type")
			setKeystoneSelected(undefined)
		}
	}, [keystoneSelected])

	useEffect(() => {

		if(sourceSelected && sourceSelected.type){
			AddQueryParam("type", sourceSelected.type)
		}
	}, [(sourceSelected || {}).type])

	const handleSelectSource = (keystone:string) => setKeystoneSelected(keystone || "")


	useEffect(() => {
        if(sourceSelected){
			const {name, type} = sourceSelected

			if(type){
				AddQueryParam("type", type)
			}

			if(name){
				setDataSource(undefined)
				GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "DataSources")
				.GetDataSource({ name })
				.then(({ data }: any) => setDataSource(data))
			}
			
        }
    }, [sourceSelected])

	return <PageDefault>
				<ColumnLayout columns="three">
					<Column width={3}>
						<SourceColumn
							selected={keystoneSelected}
							list = {listSource}
							onSelect = {handleSelectSource}/>
					</Column>
					{
						sourceSelected
						&& dataSource 
						&& sourceSelected.type
						&& dataSource.status.toUpperCase() === "READY"
						&& <Column width={13}>
							{
								sourceSelected.type === "relational-database"
								&& <RelationalDatabaseColumn source={dataSource} />
							}
							{
								sourceSelected.type === "datastore"
								&& <DatastoreColumn source={dataSource}/>
							}
							{
								sourceSelected.type === "fs"
								&& <FileSystemColumn source={dataSource}/>
							}
						</Column>
					}
				</ColumnLayout>
			</PageDefault>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	SetQueryParams    : QueryParamsActionsCreator.SetQueryParams,
	AddQueryParam     : QueryParamsActionsCreator.AddQueryParam,
	RemoveQueryParam  : QueryParamsActionsCreator.RemoveQueryParam
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(MainPage)
