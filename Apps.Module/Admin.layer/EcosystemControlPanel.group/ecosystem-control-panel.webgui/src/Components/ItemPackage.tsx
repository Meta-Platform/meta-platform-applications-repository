import * as React from "react"

import {  
    Image,
    Button,
    Label,
    Segment
} from "semantic-ui-react"

import CompareObjects from "../Utils/CompareObjects"
import ExtractURL from "../Utils/ExtractURL"

const ItemPackage = ({
    style,
    packageInformation,
    serverManagerInformation,
    paramsSelected,
    onStartPackage,
    onSelectPackage
}) => {

    const {
        applicationInServiceState,
        repositoryParams, 
        metadata, 
        packageInService,
        hasIcon
    } = packageInformation

    const port = applicationInServiceState
        ?.staticParameters
        ?.startupParams
        ?.port

    const styleCard = packageInService ? {"paddingTop":"15px"} : {}

    const colorCard = 
        applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
        ? "orange"
        : applicationInServiceState?.status === "ACTIVE"
            ? "green"
            : applicationInServiceState?.status === "FAILURE"
                ? "red"
                : undefined

    const checkIsSelected = () => {
        return CompareObjects(repositoryParams, paramsSelected)
    }

    return <Segment 
                tertiary={!!paramsSelected && !checkIsSelected()}
                onClick={() => onSelectPackage(repositoryParams)}
                style={{
                    cursor: "pointer",
                    ...checkIsSelected() ? { borderColor: "black"} : {},
                    ...styleCard, 
                    ...style||{}
                }}
                color={colorCard} >
                
                <Label size="mini">{repositoryParams.ext.toUpperCase()}</Label>
                {
                    packageInService
                    && applicationInServiceState?.status === "ACTIVE"
                    && <Label 
                        style={{"padding":"5px"}}
                        color="green" 
                        size="mini">ACTIVE</Label>
                }
                {
                    packageInService
                    && applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
                    && <Label 
                        style={{"padding":"5px"}} 
                        color="orange" 
                        size="mini"> IN SERVICE</Label>
                }
                {
                    metadata?.boot
                    && !packageInService
                    && <Button
                            style={{marginTop: "9px"}}
                            primary
                            size="mini"
                            floated="right"
                            onClick={() => onStartPackage(repositoryParams)}>
                            Execute Standard Setup
                        </Button>
                }
                {
                    metadata?.boot
                    && packageInService
                    && <Button
                            style={{marginTop: "9px"}}
                            size="mini"
                            floated="right"
                            color="green"
                            disabled={applicationInServiceState?.status !== "ACTIVE"}
                            onClick={() => window.open(`http://localhost:${port}`, '_blank')}>
                            Open Application
                        </Button>
                }
                {
                    hasIcon 
                    && <Image
                            floated='left'
                            size='mini'
                            src={ExtractURL({ 
                                serversStatus: serverManagerInformation.list_web_servers_running,
                                apiName:"RepositoryManager",  
                                serverName: process.env.SERVER_APP_NAME,
                                summary:"GetPackageIcon",
                                args:repositoryParams
                            })}
                            style={{marginBottom:"0px"}}/>
                }
                <br/>
                <p style={{marginTop: "5px"}}>
                   <i>{repositoryParams.namespaceRepo}</i>{`.${repositoryParams.moduleName}.${repositoryParams.layerName}${repositoryParams.parentGroup ? `.${repositoryParams.parentGroup}`: ""}.`} <strong>{repositoryParams.packageName}</strong>
                </p>
            
            </Segment>
}

export default ItemPackage