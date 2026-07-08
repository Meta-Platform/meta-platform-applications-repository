import * as React from "react"

import {
    Header,
    Image,
    Label
} from "semantic-ui-react"

import ExtractURL from "../Utils/ExtractURL"

type HeaderDetailsProps = {
    packageInformation : any
    serverManagerInformation : any
}

const HeaderDetails = ({
    packageInformation,
    serverManagerInformation
}:HeaderDetailsProps) => {

    const {
        packageName,
        ext,
        namespaceRepo,
        moduleName,
        layerName
    } = packageInformation?.repositoryParams || {}

    return <>
            {
                packageInformation
                && <Header as='h2' textAlign='center'>
                    {
                        packageInformation?.hasIcon
                        && <Image 
                                src={ExtractURL({ 
                                    serversStatus:serverManagerInformation.list_web_servers_running,
                                    apiName:"RepositoryManager",  
                                    serverName: process.env.SERVER_APP_NAME,
                                    summary:"GetPackageIcon",
                                    args:packageInformation.repositoryParams})}/>
                    }
                    <Header.Content>
                        {packageName}
                        <Label>
                            {ext.toUpperCase()}
                        </Label>
                        <Header.Subheader>
                            <strong>{namespaceRepo}</strong> {moduleName} <i>{layerName}</i>
                        </Header.Subheader>
                    </Header.Content>
                </Header>
            }
            </>
}

export default HeaderDetails