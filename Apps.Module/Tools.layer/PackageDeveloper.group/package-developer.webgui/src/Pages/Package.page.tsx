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

import PageDefault from "../Components/PageDefault"
import ExplorerColumn     from "../Columns/Explorer.column"
import DetailsColumn       from "../Columns/Details.column"
import ColumnGroup from "../Layouts/Column.layout/ColumnGroup"
import PackageManagerActionsCreator from "../Actions/PackageManager.actionsCreator"
import QueryParamsActionsCreator    from "../Actions/QueryParams.actionsCreator"

import GetRequestByServer from "../Utils/GetRequestByServer"

const Column = Grid.Column

const PackagePage = ({
	HTTPServerManager,
	SetQueryParams,
	QueryParams,
	SetPackageDetails
}:any) => {

	const { workspace, packageName, ext } = useParams()
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
	

	//==========================================================================================================================
	useEffect(() => {
        if(packageName && ext && workspace){
			updateDetails()
        }
	}, [packageName, ext, workspace])
	//==========================================================================================================================
	
	const updateDetails = () => {
		SetPackageDetails(undefined)
		GetRequestByServer(HTTPServerManager)(process.env.SERVER_APP_NAME, "WebappExplorer")
        .GetDetails({workspace:workspace, packageName, ext})
		.then(({data}:any) => SetPackageDetails(data))
	}

	return <PageDefault>
				<ColumnGroup columns="three">
					{
						packageName
						&& <Column width={5}>
								<ExplorerColumn
									packageSelected = {{name:packageName, ext}}
									workspace = {workspace}/>
							</Column>
					}
					{
						packageName
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


export default connect(mapStateToProps, mapDispatchToProps)(PackagePage)
