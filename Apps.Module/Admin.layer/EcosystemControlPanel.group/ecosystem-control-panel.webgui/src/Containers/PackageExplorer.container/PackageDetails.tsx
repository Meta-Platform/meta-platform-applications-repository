import * as React from "react"
import { useState, useEffect } from "react"

import {
    Segment,
    Label,
    Button,
    Grid,
    Tab,
    TabPane,
    Loader
} from "semantic-ui-react"

import CompareObjects from "../../Utils/CompareObjects"
import HeaderDetails from "../../Components/HeaderDetails"
import StartupParamsForm from "../../Components/StartupParamsForm"
import GetAPI from "../../Utils/GetAPI"

import DependencyDiagram from "./DependencyDiagram"

const FindPackageInformation = (list, params) => 
    list.find(
        (packageInformation) => 
            CompareObjects(packageInformation.repositoryParams, params))

const PackageDetails = ({
    packageList,
    repositoryParams,
    serverManagerInformation,
    onStartPackage,
    onClose,
}) => {

    const [ packageInformation, setPackageInformation ] = useState<any>()
    const [ isOriginalParams, setIsOriginalParams ] = useState(true)
    const [ newStartupParams, setNewStartupParams ] = useState()
    const [ dependencyHierarchy, setDependencyHierarchy ] = useState()

    useEffect(() => {
        if(packageList){
            setPackageInformation(FindPackageInformation(packageList, repositoryParams))
        }
    }, [repositoryParams, packageList])

    useEffect(() => {
        if(packageInformation){
            fetchDependencyHierarchy()
        }
    }, [packageInformation])

    const getRepositoryManagerAPI = () => 
        GetAPI({ 
            apiName:"RepositoryManager",  
            serverManagerInformation 
        })

    const fetchDependencyHierarchy = async () => {
        try {
            setDependencyHierarchy(undefined)
            const api = getRepositoryManagerAPI()
            const response = await api.GetPackageDependencyHierarchy(packageInformation.repositoryParams)
            const metadataHierarchy = response.data
            setDependencyHierarchy(metadataHierarchy)
        }catch(e){
            console.log(e)
        }
    }

    const panes = [
        {
            menuItem: 'dependency diagram',
            render: () => <TabPane>
                {
                    dependencyHierarchy
                    ? <DependencyDiagram dependencyHierarchy={dependencyHierarchy}/>
                    : <Loader/>
                }
            </TabPane>
        },
        {
            menuItem: 'startup parameters',
            render: () => <TabPane>
                {
                    packageInformation?.metadata
                    && packageInformation?.metadata["startup-params-schema"]
                    && <StartupParamsForm 
                        schema={packageInformation?.metadata["startup-params-schema"]}
                        params={packageInformation?.metadata["startup-params"] }
                        onChangeParams={(params) => handleChangeParams(params)}
                        />
                }
            </TabPane>
        }
    ]

    const handleChangeParams = (params) => {
        setIsOriginalParams(CompareObjects(params, packageInformation?.metadata["startup-params"]))
        setNewStartupParams(params)
    }

    const handleStartPackage = () => {
        const { repositoryParams } = packageInformation

        const params = {
            ...repositoryParams,
            ...isOriginalParams 
                ? {}
                : {
                    startupParams : newStartupParams
                }
        }
        onStartPackage(params)
    }

    const getSegmentStyle = () => {
        const styleBase = {
            boxShadow: "2px 2px 8px 2px rgba(0, 0, 0, 0.2)",
        }

        return packageInformation?.packageInService 
            ? {
                ...styleBase,
                paddingTop: "5px"
            } 
            : styleBase
    }

    const GetPort = () => {
        return packageInformation
                ?.applicationInServiceState
                ?.staticParameters
                ?.startupParams
                ?.port
    }

    return <Segment style={getSegmentStyle()}>

                <Button 
                    circular 
                    icon='close' 
                    floated="right"
                    onClick={() => onClose()} />

                {
                    packageInformation?.packageInService
                    && packageInformation?.applicationInServiceState?.status === "ACTIVE"
                    && <Label size="small" color="green" attached='top left'>ACTIVE</Label>
                }
                {
                    packageInformation?.packageInService
                    && packageInformation?.applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
                    && <Label size="small" color="orange" attached='top left'> IN SERVICE</Label>
                }
                <HeaderDetails 
                    packageInformation={packageInformation}
                    serverManagerInformation={serverManagerInformation}/>

                <Tab menu={{ secondary: true, pointing: true }} panes={panes} />
                {
                    packageInformation?.metadata?.boot
                    && !packageInformation?.packageInService
                    && <Grid>
                        <Grid.Row>
                            <Grid.Column width={16} textAlign="right">
                                <Button 
                                    style={{marginTop:"10px"}}
                                    color={isOriginalParams?"blue":"orange"}
                                    content={isOriginalParams?"Execute Standard Setup":"Run with Changes"}
                                    onClick={() => handleStartPackage()} />
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                }
                {
                    packageInformation?.metadata?.boot
                    && packageInformation?.packageInService
                    && <Grid>
                        <Grid.Row>
                            <Grid.Column width={16} textAlign="right">
                                <Button 
                                    style={{marginTop:"10px"}}
                                    color="green"
                                    disabled={packageInformation?.applicationInServiceState?.status !== "ACTIVE"}
                                    onClick={() => window.open(`http://localhost:${GetPort()}`, '_blank')}>
                                        Open Application
                                </Button>
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                }
                </Segment>
}

export default PackageDetails