import * as React             from "react"
import { useEffect, useState} from "react"
import styled                 from "styled-components"

import {
	Segment, 
	Grid, 
	Container
} from "semantic-ui-react"


import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import GetRequestByServer from "../Utils/GetRequestByServer"

import APIColumn      from "../Columns/API.column"
import EndpointColumn from "../Columns/Endpoint.column"
import DetailsColumn  from "../Columns/Details.column"

const SegmentStyle = styled(Segment)`
    background-color: #fff !important;
    border-color: #ffffff00 !important;
`

type APIDesignerParamsType = {
	api     ?: string
	summary ?: string
}

type APIDesignerContainerProps = {
	queryParams         : APIDesignerParamsType
	onChangeQueryParams : any
	HTTPServerManager   : any
}

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const APIDesignerContainer = ({
	queryParams,
	onChangeQueryParams, 
	HTTPServerManager
}:APIDesignerContainerProps) => {
	
	//TODO Melhorar tipagem
	const [APIDesignerRequest, setRequest]              = useState<any>()
	const [listAPI, setListAPI]                         = useState<Array<string>>([])
	
	const [APISelected, setAPISelected]                 = useState<string>()
	const [listEndpoint, setListEndpoints]              = useState([])
	const [endpointSelected, setEndpointSelected]       = useState()

	const [APIForCreate, setAPIForCreate]               = useState<string>()
	const [endpointForCreate, setEndpointForCreate]     = useState<string>()
	const [methodForCreate, setMethodForCreate]         = useState("GET")
	const [errorMessage, setErrorMessage]               = useState()
	
	const [pathForUpdate, setPathForUpdate]             = useState<string>()
	const [methodForUpdate, setMethodForUpdate]         = useState<string>()
	const [parametersForUpdate, setParametersForUpdate] = useState()

	useEffect(() => setRequest(GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "APIDesigner")), [])
	useEffect(() => updateListWebservices()                                           , [APIDesignerRequest])
	useEffect(() => selectAPIAfterListAPI()                                           , [listAPI])
	useEffect(() => selectFirstEndpointIfNoExitsSelectedCaseExitsUpdated()            , [listEndpoint])

	useEffect(() => {
		if(endpointSelected) updateQueryParams()                                             
	}  , [endpointSelected])

	useEffect(() => {
		if(APISelected){
			updateQueryParams()
		}
		setEndpointSelected(undefined)
		updateListEndpoints()
	}, [APISelected])


	const updateQueryParams = () => {
		onChangeQueryParams({
			...queryParams, 
			api      : APISelected,
			...(
				//@ts-ignore
				endpointSelected 
				//@ts-ignore
				&& endpointSelected.summary 
				//@ts-ignore
				? {summary : endpointSelected.summary}
				: {}
			)
		})
	}

	const selectFirstEndpointIfNoExitsSelectedCaseExitsUpdated = () => {
		if(listEndpoint.length > 0){
			if(!endpointSelected){
				if(queryParams.summary && queryParams.summary !== ""){
					const endpoint = listEndpoint.find(({summary}:any) => summary === queryParams.summary)
					setEndpointSelected(endpoint ? endpoint : listEndpoint[0])
				}else{
					setEndpointSelected(listEndpoint[0])
				}
			}
		}
	}

	const selectAPIAfterListAPI = () => {
		if(listAPI.length > 0 && !APISelected){
			if(queryParams.api && queryParams.api !== "" && listAPI.indexOf(queryParams.api) > -1){
				setAPISelected(queryParams.api)
			}else{
				setAPISelected(listAPI[0])
			}
		}
	}

	const updateListWebservices = () => {
		if(APIDesignerRequest){
			//@ts-ignore
			APIDesignerRequest
			.ListAPI()
			.then(({data}:any) => setListAPI(data))
		}
	}

	const updateListEndpoints = () => {
		if(APISelected){
			//@ts-ignore
			APIDesignerRequest
			.ListEndpoints({api:APISelected})
			.then(({data}:any) => setListEndpoints(data.endpoints))
		}
	}

	const handleCreateAPI = ()=> {
		//@ts-ignore
		APIDesignerRequest
			.CreateAPI({name:APIForCreate})
			.then(({data}:any) => {
				setAPISelected(APIForCreate)
				setAPIForCreate("")
				setErrorMessage(undefined)
				updateListWebservices()
			})
			.catch((error:any) => {
				const {response} = error
				if(response){
					const {data} = response
					if(data){
						setErrorMessage(data.message)
					}
				}
			})
	}

	const handleCreateEndpoint = () => {
		//@ts-ignore
		APIDesignerRequest
			.CreateEndpoint({
				api      : APISelected, 
				endpoint : endpointForCreate,
				method   : methodForCreate
			})
			.then(({data}:any) => {
				setEndpointForCreate("")
				setMethodForCreate("GET")
				updateListEndpoints()
			})
			.catch((error:any) => {
				const {response} = error
				if(response){
					const {data} = response
					if(data){
						setErrorMessage(data.message)
					}
				}
			})
	}

	const handleConfirmEndpointEditing = async() => {
		
		const UpdatePath = () => 
		//@ts-ignore
			APIDesignerRequest
			.UpdatePath({
				api:APISelected,
				//@ts-ignore
				endpoint:endpointSelected.summary,
				path:pathForUpdate
			})

		const UpdateMethod = () => 
			//@ts-ignore
			APIDesignerRequest
			.UpdateMethod({
				api:APISelected,
				//@ts-ignore
				endpoint:endpointSelected.summary,
				method:methodForUpdate
			})

		const UpdateParameters = () => 
			//@ts-ignore
			APIDesignerRequest
			.UpdateParameters({
				api:APISelected,
				//@ts-ignore
				endpoint:endpointSelected.summary,
				parameters:parametersForUpdate
			})

		try{
			if(pathForUpdate){
				await UpdatePath()
				setPathForUpdate(undefined)
			}

			if(methodForUpdate){
				await UpdateMethod()
				setMethodForUpdate(undefined)
			}
			
			if(parametersForUpdate){
				await UpdateParameters()
				setParametersForUpdate(undefined)
			}

		}catch(e){
			console.log(e)
		}finally {
			updateListEndpoints()
		}
	}

	const handleCancelEndpointEditing = () => {
		setPathForUpdate(undefined)
		setMethodForUpdate(undefined)
		setParametersForUpdate(undefined)
	}

	const hasPendingChanges = !!(pathForUpdate || methodForUpdate || parametersForUpdate)
	
	return <Container fluid={true}>
		<div>
			<SegmentStyle attached="bottom">
				<Grid columns="three" divided>
							<Grid.Row>
								<Grid.Column width={3}>
									<APIColumn
										onChangeAPIForCreate = {setAPIForCreate}
										onChangeAPI          = {setAPISelected}
										APISelected          = {APISelected}
										listAPI              = {listAPI}
										APIForCreate         = {APIForCreate}
										onCreateAPI          = {handleCreateAPI}
										errorMessage         = {errorMessage}
									/>
								</Grid.Column>
								<Grid.Column width={4}>
									<EndpointColumn
										endpointSelected          = {endpointSelected}
										listEndpoint              = {listEndpoint}
										methodForCreate           = {methodForCreate}
										endpointForCreate         = {endpointForCreate}
										onCreateEndpoint          = {handleCreateEndpoint}
										onChangeSummary           = {(indexSummary:number) => setEndpointSelected(listEndpoint[indexSummary])}
										onChangeEndpointForCreate = {(endpointForCreate:any) => setEndpointForCreate(endpointForCreate)}
										onChangeMethodForCreate   = {(e:any, {value}:any) => setMethodForCreate(value)}/>
								</Grid.Column>
								<Grid.Column>
									<DetailsColumn
									    hasPendingChanges        = {hasPendingChanges}
										endpointSelected         = {endpointSelected}
										methodForUpdate          = {methodForUpdate}
										parametersForUpdate      = {parametersForUpdate}
										pathForUpdate             = {pathForUpdate}
										onChangeUrl              = {(path:string) => setPathForUpdate(path)}
										onChangeMethod           = {(method:string) => setMethodForUpdate(method)}
										onChangeParameters       = {(parameters:any)=> setParametersForUpdate(parameters)}
										onCancelEndpointEditing  = {handleCancelEndpointEditing}
										onConfirmEndpointEditing = {handleConfirmEndpointEditing}
									/>
								</Grid.Column>
							</Grid.Row>
						</Grid>
			</SegmentStyle>
		</div>
	</Container>

}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({

}, dispatch)

const mapStateToProps = ({HTTPServerManager}:any) => ({
	HTTPServerManager
})
export default connect(mapStateToProps, mapDispatchToProps)(APIDesignerContainer)
