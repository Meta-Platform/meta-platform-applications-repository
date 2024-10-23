import * as React             from "react"
import { useEffect}           from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import { Grid}                from "semantic-ui-react"
import qs                     from "query-string"
import { 
	useLocation,
	useNavigate,
	useParams
  } from "react-router-dom"

import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"

import PageDefault from "../Components/PageDefault"
import PackageList       from "../Lists/Package.list"
import ExplorerColumn     from "../Columns/Explorer.column"
import DetailsColumn       from "../Columns/Details.column"

import usePackageState     from "../Hooks/usePackageState"

import PackageManagerActionsCreator from "../Actions/PackageManager.actionsCreator"
import QueryParamsActionsCreator    from "../Actions/QueryParams.actionsCreator"

import GetRequestByServer from "../Utils/GetRequestByServer"

const Column = Grid.Column
const LIST_QUERY_PARAMS = ["packageName", "ext", "explorer", "module", "item", "endpointName"]

//Todo Diminuir a quantidade de parametros
const WorkspacePage = ({
	HTTPServerManager,
	SetQueryParams,
	AddQueryParam,
	RemoveQueryParam,
	PackageManager,
	QueryParams,
	SetPackageDetails
}:any) => {

	const { workspace } = useParams()
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
        listPackages,
        packageSelected,
        setPackageSelected
	}
	= usePackageState({HTTPServerManager, workspace})

	useEffect(() => {

		const {packageName, ext} = QueryParams

		if(ext && packageName && packageName !== "" && ext !== ""){
			setPackageSelected({name:packageName, ext})
		}
	},  [listPackages])


	useEffect(() => { 
		if(packageSelected){
			AddQueryParam("packageName", packageSelected.name)
			AddQueryParam("ext", packageSelected.ext)
		}
	}, [packageSelected])

	//==========================================================================================================================
	useEffect(() => {
        if(packageSelected && workspace){
			SetPackageDetails(undefined)
			updateDetails()
			.then(({data}:any) => SetPackageDetails(data))
        }
	}, [packageSelected, workspace])
	//==========================================================================================================================
	
	const updateDetails = () => 
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "WebappExplorer")
        .GetDetails({
			workspace:workspace,
			packageName:packageSelected.name,
			ext:packageSelected.ext
		})


	const removeAllQueryParams = () => {
		LIST_QUERY_PARAMS
		.forEach(paramName => {
			RemoveQueryParam(paramName)
		})
	}

	const handleChangePackage = (packageSelected:{name:string, ext:string}) => {
		removeAllQueryParams()
		setPackageSelected(packageSelected)
	}

	return <PageDefault>
				<ColumnGroup columns="three">
					{
						workspace
						&& <Column width={4}>
							<h3>Package Developer</h3>
							<PackageList 
								workspaceSelected = {workspace}
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
									workspace = {workspace}/>
							</Column>
					}
					{
						packageSelected
						&& PackageManager.package_details
						&& <Column width={5}>
								<DetailsColumn workspace={workspace}/>
							</Column>
					}
				</ColumnGroup>
			</PageDefault>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	SetPackageDetails : PackageManagerActionsCreator.SetPackageDetails,
	SetQueryParams    : QueryParamsActionsCreator.SetQueryParams,
	AddQueryParam     : QueryParamsActionsCreator.AddQueryParam,
	RemoveQueryParam  : QueryParamsActionsCreator.RemoveQueryParam
}, dispatch)

const mapStateToProps = ({HTTPServerManager, PackageManager, QueryParams}:any) => ({
	HTTPServerManager,
	PackageManager,
	QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(WorkspacePage)
