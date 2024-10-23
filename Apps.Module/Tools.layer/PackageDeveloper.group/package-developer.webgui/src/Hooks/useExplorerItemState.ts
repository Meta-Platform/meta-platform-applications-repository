import {useState, useEffect}  from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const useExplorerItemState = ({
    packageName,
    ext,
    workspace,
    serverName,
    apiName,
    summary,
    expanded,
    HTTPServerManager
}:any) => {
    
    const [data, setData]            = useState<any>()
    const [isExpanded, setExpansion] = useState<Boolean>(expanded)

    useEffect(() => {
        if(packageName && ext){
            update()
        }
    }, [packageName, ext])

    const update = () => {
        setData(undefined)
        GetRequestByServer(HTTPServerManager)(serverName, apiName)[summary]({workspace, packageName, ext})
        .then(({data}:any) => setData(data))
    }

    return {
        data, isExpanded, setExpansion
    }
}

export default useExplorerItemState