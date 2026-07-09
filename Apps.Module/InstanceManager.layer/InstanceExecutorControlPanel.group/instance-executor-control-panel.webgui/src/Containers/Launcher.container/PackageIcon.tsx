import * as React from "react"

import { Icon } from "semantic-ui-react"

import ExtractURL from "../../Utils/ExtractURL"

// Ícone do pacote, servido pelo endpoint GetPackageIcon. Quando o pacote não tem
// ícone próprio (ou a imagem falha), cai no cubo genérico.
const PackageIcon = ({ packageInformation, serverManagerInformation, size = 18 }:any) => {

    const [ hasFailed, setHasFailed ] = React.useState(false)

    const showFallback = !packageInformation?.hasIcon || hasFailed

    if(showFallback)
        return <Icon name="cube" style={{ margin: 0, color: "var(--mp-muted)", flex: "0 0 auto" }}/>

    return <img
        src={ExtractURL({
            serversStatus: serverManagerInformation.list_web_servers_running,
            apiName: "RepositoryManager",
            serverName: process.env.SERVER_APP_NAME,
            summary: "GetPackageIcon",
            args: packageInformation.repositoryParams
        })}
        onError={() => setHasFailed(true)}
        style={{ width: size, height: size, objectFit: "contain", flex: "0 0 auto" }}/>
}

export default PackageIcon
