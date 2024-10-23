import * as React from "react"

import {  
    Image,
    Loader,
    Label,
    Segment,
    Button
} from "semantic-ui-react"

import ExtractURL from "../../Utils/ExtractURL"

const CardApplication = ({
    packageInformation,
    serverManagerInformation,
    onShowDetailsColumn
}) => {

    const {
        applicationInServiceState,
        repositoryParams, 
        packageInService,
        hasIcon
    } = packageInformation

    const styleCard = packageInService ? {"paddingTop":"15px"} : {}

    const colorCard = 
        applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
        ? "orange"
        : applicationInServiceState?.status === "ACTIVE"
            ? "green"
            : applicationInServiceState?.status === "FAILURE"
                ? "red"
                : undefined

    const port = applicationInServiceState
                ?.staticParameters
                ?.startupParams
                ?.port

    return <Segment 
                style={{...styleCard, height: "100%", cursor: "pointer", width:"240px"}}
                color={colorCard} 
                onClick={() => onShowDetailsColumn(packageInformation)}>
                
                <Label size="mini">{repositoryParams.ext.toUpperCase()}</Label>
                {
                    packageInService
                    && applicationInServiceState?.status === "ACTIVE"
                    && <Label 
                        attached="top right"
                        color="green" 
                        size="mini">ACTIVE</Label>
                }
                {
                    packageInService
                    && applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
                    && <Label 
                        attached="top right"
                        color="orange" 
                        size="mini"> IN SERVICE</Label>
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
                <strong>{repositoryParams.packageName}</strong>
            
            {
                packageInService
                && applicationInServiceState?.status === "AWAITING_PRECONDITIONS"
                && <div>
                        <Loader size='small' active inline='centered' />
                    </div>
            }
            <div style={{marginBottom:"0px", marginTop:"5px", display: 'flex', justifyContent: 'flex-end'}}>
                <Button 
                    size="mini"
                    compact
                    color="green"
                    disabled={applicationInServiceState?.status !== "ACTIVE"}
                    onClick={() => window.open(`http://localhost:${port}`, '_blank')}>
                        Open Application
                </Button>
            </div>
            </Segment>
}

export default CardApplication