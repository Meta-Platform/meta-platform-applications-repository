import * as React              from "react"
import { useState, useEffect } from "react"
import { connect }             from "react-redux"
import { bindActionCreators }  from "redux"

import {
    Grid, 
    Input, 
    Checkbox,
    Segment,
    ButtonGroup
} from "semantic-ui-react"

import GetAPI from "../../Utils/GetAPI"

import QueryParamsActionsCreator from "../../Actions/QueryParams.actionsCreator"

import useWebSocket from "../../Hooks/useWebSocket"

import PackageList from "./PackageList"
import PackageDetails from "./PackageDetails"

type PackageType = {
    namespaceRepo: string
    packageName: string
    moduleName: string
    layerName: string
    parentGroup: string
    ext: string
}

const PackageExplorerContainer = ({ serverManagerInformation, QueryParams, AddQueryParam }:any) => {

    const [ packageList, setPackageList ] = useState<PackageType[]>([])
    const [ packageListFiltered, setPackageListFiltered ] = useState<PackageType[]>()
    const [ bootableFilter, setBootableFilter ] = useState(false)
    const [ filterValue, setFilterValue ] = useState<string>()
    const [ isLoading, setIsLoading ] = useState(true)
    const [ packageRepoParamsSelected, setPackageRepoParamsSelected] = useState()

    const getRuntimeManagerAPI = () => 
        GetAPI({ 
            apiName:"EcosystemManager",  
            serverManagerInformation 
        })

    useEffect(() => {
        if(QueryParams.bootable === "true")
            setBootableFilter(true)

        if(QueryParams.filterValue)
            setFilterValue(QueryParams.filterValue)

    }, [])

    useEffect(() => {

        if(packageList){
            if(packageListFiltered){
                filterPacakgeList()
            }
        }

    }, [packageList])

    useEffect(() => {
        if(filterValue){
            filterPacakgeList()
            AddQueryParam("filterValue", filterValue)
        }
    }, [filterValue])

    useEffect(() => {
		AddQueryParam("bootable", bootableFilter)
	}, [bootableFilter])

    useWebSocket({
        socket: getRuntimeManagerAPI().PackageList,
        onMessage: (message) => setPackageList(message),
        onConnection: () => {
            fetchPackageList()
        },
        onDisconnection: () => setPackageList([])
    })

    const fetchPackageList = async () => {
        try {
            const api = getRuntimeManagerAPI()
            const response = await api.ListPackages()
            const packageList = response.data
            setPackageList(packageList)
            setIsLoading(false)

        }catch(e){
            console.log(e)
        }
    }

    const runPackage = async (packageParams) => {
        try {
            setIsLoading(true)
            const api = getRuntimeManagerAPI()
            await api.RunPackage(packageParams)
        }catch(e){
            console.log(e)
        }
    }

    const handleStartPackage = async (packageParams) => {
        await runPackage(packageParams)
        fetchPackageList()
    }
    
    const filterPacakgeList = () => {
        const filteredList = packageList
        .filter(({repositoryParams}:any) => {
            return Object.values(repositoryParams).some(param => 
                param.toString().toLowerCase().includes(filterValue.toLowerCase())
            )
        })
        setPackageListFiltered(filteredList)
    }

    const handleFilterPackageList = (filterValue:string) => setFilterValue(filterValue)

    const handleSelectPackage = (params) => setPackageRepoParamsSelected(params)

    return <Grid style={{padding:"1em"}}>
                <Grid.Row>
                    <Grid.Column width={packageRepoParamsSelected ? 8 : 16}>
                        <Grid.Row>
                            <Input 
                                icon='filter' 
                                placeholder='package filter' 
                                value={filterValue}
                                onChange={({target:{value}}) => handleFilterPackageList(value)}
                                />
                                <Checkbox 
                                    style={{marginLeft:"5px"}} 
                                    label='bootable' 
                                    checked={bootableFilter}
                                    onChange={(e:any, {checked}:any) => setBootableFilter(checked)}/>
                                <ButtonGroup
                                    floated="right"
                                    buttons={[
                                        { key: 'card-view', icon: 'th' },
                                        { key: 'list-view', icon: 'th list' }
                                    ]}/>
                        </Grid.Row>
                        <PackageList
                            paramsSelected={packageRepoParamsSelected}
                            isLoading={isLoading}
                            packageList={(packageListFiltered || packageList).filter(({metadata}:any) => bootableFilter ? metadata?.boot : true)}
                            serverManagerInformation={serverManagerInformation}
                            onStartPackage={handleStartPackage}
                            onSelectPackage={handleSelectPackage}/>
                    </Grid.Column>
                    {
                        packageRepoParamsSelected
                        && <Grid.Column width={8}>
                                <PackageDetails
                                    repositoryParams={packageRepoParamsSelected}
                                    serverManagerInformation={serverManagerInformation}
                                    packageList={packageList}
                                    onClose={() => setPackageRepoParamsSelected(undefined)}
                                    onStartPackage={handleStartPackage}/>
                            </Grid.Column>
                    }
                    
                </Grid.Row>
            </Grid>
         
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
	AddQueryParam  : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({QueryParams}:any) => ({QueryParams})

export default connect(mapStateToProps, mapDispatchToProps)(PackageExplorerContainer)