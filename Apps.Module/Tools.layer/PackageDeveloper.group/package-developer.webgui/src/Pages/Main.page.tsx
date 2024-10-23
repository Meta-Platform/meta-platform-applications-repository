import * as React             from "react"
import { useEffect}           from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Grid }               from "semantic-ui-react"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate
  } from "react-router-dom"

import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"

import PageDefault from "../Components/PageDefault"
import PackageList from "../Lists/Package.list"

import ExplorerColumn  from "../Columns/Explorer.column"
import DetailsColumn   from "../Columns/Details.column"
import WorkspaceColumn from "../Columns/Workspace.column"

import usePackageState   from "../Hooks/usePackageState"
import useWorkspaceState from "../Hooks/useWorkspaceState"

import PackageManagerActionsCreator from "../Actions/PackageManager.actionsCreator"
import QueryParamsActionsCreator    from "../Actions/QueryParams.actionsCreator"

import GetRequestByServer from "../Utils/GetRequestByServer"

const Column = Grid.Column

const LIST_QUERY_PARAMS = ["packageName", "ext", "explorer", "module", "item", "endpointName"]

const MainPage = ({
	HTTPServerManager,
	SetPackageDetails,
	SetQueryParams,
	AddQueryParam,
	RemoveQueryParam,
	QueryParams
}:any) => {
	
	const location = useLocation()
  	const navigate = useNavigate()
	const queryParams = qs.parse(location.search.substr(1))

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
		listWorkspaces,
        workspaceSelected,
        setWorkspaceSelected
	} = useWorkspaceState({HTTPServerManager})

	const {
        listPackages,
        packageSelected,
        setPackageSelected
	}
	= usePackageState({HTTPServerManager, workspace:workspaceSelected})

	useEffect(() => {
		if(QueryParams.workspace && QueryParams.workspace !== ""){
			setWorkspaceSelected(QueryParams.workspace)
		}
	}, [listWorkspaces])

	useEffect(() => {
		const {packageName, ext} = QueryParams
		if(packageName && packageName !== ""){
			setPackageSelected({
				name:packageName,
				ext
			})
		}
	},  [listPackages])

	useEffect(() => { 
		if(workspaceSelected){
			AddQueryParam("workspace", workspaceSelected)
		}
	}, [workspaceSelected])

	useEffect(() => { 
		if(packageSelected){
			AddQueryParam("packageName", packageSelected.name)
			AddQueryParam("ext", packageSelected.ext)
		}
	}, [packageSelected])

	//==========================================================================================================================
	useEffect(() => {
        if(packageSelected && workspaceSelected){
			SetPackageDetails(undefined)
			updateDetails()
			.then(({data}:any) => SetPackageDetails(data))
        }
	}, [packageSelected, workspaceSelected])
	//==========================================================================================================================
	
	const updateDetails = () => 
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "WebappExplorer")
        .GetDetails({
			workspace:workspaceSelected,
			packageName:packageSelected.name,
			ext:packageSelected.ext
		})


	const removeAllQueryParams = () => {
		LIST_QUERY_PARAMS
		.forEach(paramName => {
			RemoveQueryParam(paramName)
		})
	}

	const handleChangeWorkspace = (workspace:string) => {
		removeAllQueryParams()
		setWorkspaceSelected(workspace)
	}

	const handleChangePackage = (packageSelected:{name:string, ext:string}) => {
		removeAllQueryParams()
		setPackageSelected(packageSelected)
	}

	return <PageDefault>
				<ColumnGroup columns="three">
					<Column width={3}>
						<WorkspaceColumn
							selected = {workspaceSelected}
							list     = {listWorkspaces}
							onSelect = {handleChangeWorkspace}/>
					</Column>
					{
						workspaceSelected
						&& <Column width={4}>
							<a href={`#/Workspace/${workspaceSelected}?${qs.stringify(QueryParams)}`}><h3>Packages</h3></a>
							<PackageList 
								workspaceSelected = {workspaceSelected}
								packageSelected   = {packageSelected}
								list              = {listPackages || []}
								onSelect          = {handleChangePackage}/>
						</Column>
					}
					{
						packageSelected
						&& <Column width={5}>
								<ExplorerColumn
									packageSelected = {packageSelected}
									workspace = {workspaceSelected}/>
							</Column>
					}
					{
						packageSelected
						&& <Column width={4}>
								<DetailsColumn workspace={workspaceSelected}/>
							</Column>
					}
				</ColumnGroup>
			</PageDefault>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	SetPackageDetails : PackageManagerActionsCreator.SetPackageDetails,
	SetQueryParams    : QueryParamsActionsCreator.SetQueryParams,
	AddQueryParam     : QueryParamsActionsCreator.AddQueryParam,
	RemoveQueryParam  : QueryParamsActionsCreator.RemoveQueryParam,
}, dispatch)

const mapStateToProps = ({HTTPServerManager, PackageManager, QueryParams}:any) => ({
	HTTPServerManager,
	PackageManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(MainPage)
