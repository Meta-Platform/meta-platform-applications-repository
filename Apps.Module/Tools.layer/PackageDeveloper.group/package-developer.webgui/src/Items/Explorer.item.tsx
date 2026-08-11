import * as React             from "react"
import {useEffect}            from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import { Icon, Spinner, QueryParamsActionsCreator } from "@i-components"
import PackageManagerActionsCreator from "../Actions/PackageManager.actionsCreator"
import useExplorerItemState  from "../Hooks/useExplorerItemState"


type ExplorerItemProps =
{
    title             : string
    iconItem          : any
    iconSubItem       : any
	workspace         : string
    packageName       : string
    ext               : string
    serverName        : string
    apiName           : string
    summary           : string
    formatter        ?: any
    expanded         ?: Boolean
    HTTPServerManager : any
    QueryParams       : any
    AddQueryParam     : Function
    RemoveQueryParam  : Function
    SetUIRoutes       : Function
}

const ExplorerItem = ({
    title,
    iconItem,
    iconSubItem,
    workspace,
    packageName,
    ext,
    serverName,
    apiName,
    summary,
    expanded,
    formatter,
    HTTPServerManager,
    QueryParams,
    AddQueryParam,
    RemoveQueryParam,
    SetUIRoutes
}:ExplorerItemProps) => {

    const { data, isExpanded, setExpansion} = useExplorerItemState({
        workspace,
        packageName,
        ext,
        serverName,
        apiName,
        summary,
        expanded,
        HTTPServerManager})

    useEffect(() => {
        const {endpointName} = QueryParams

        if(endpointName && endpointName === `${apiName}.${summary}`){
            setExpansion(true)
        }

    }, [QueryParams])

    const isSelected = () => {
        const {endpointName} = QueryParams
        return !!(endpointName && endpointName === `${apiName}.${summary}`)
    }

    useEffect(() => {
        if(data){
            if(apiName === "WebguiExplorer"){
                if(summary === "GetRoutes"){
                    SetUIRoutes(data)
                }
            }else if(apiName === "WebserviceExplorer"){

            }else if(apiName === "LibraryExplorer"){

            }else{
                console.error(`apiName [${apiName}] don't exist!`)
            }
        }
    }, [data])
//TODO Quase OK falta pouco
    /*
    useEffect(()=>{
        const {endpointName, item} = QueryParams
        if(endpointName && item){
            const [_, summary] = endpointName.split(".")
            const [summary_] = item.split(".")
            if(summary !== summary_){
                RemoveQueryParam("item")
            }
        }
    }, [QueryParams])
    */

    const handleChangeCollection = () => {
        AddQueryParam("endpointName", `${apiName}.${summary}`)
    }

    return <div
                className={`pdx-tree-item pdx-explorer-item ${isSelected() ? "is-selected" : ""}`.trim()}
                onClick={handleChangeCollection}>
                <Icon name={iconItem} className="pdx-tree-item__icon"/>
                <div className="pdx-tree-item__content">
                    <div className="pdx-tree-item__header"><a onClick={()=> setExpansion(!isExpanded)}>{title} {data && data.length > 0 && `(${data.length})`}</a>{!data && !isExpanded && <Spinner size="sm"/>}</div>
                    {
                        data
                        && isExpanded
                        && <div className="pdx-tree-sublist">
                            {
                                data
                                .map((item:any, key:any) =>
                                    <div
                                        key={key}
                                        className={`pdx-tree-item pdx-explorer-subitem ${
                                            !!(
                                                QueryParams.item
                                                && QueryParams.item === `${summary}.${formatter ? formatter(item) : item}`) ? "is-selected" : ""}`.trim()}
                                        onClick={() => AddQueryParam("item", `${summary}.${formatter ? formatter(item) : item}`)}>
                                        <Icon name={iconSubItem} className="pdx-tree-item__icon"/>
                                        <div className="pdx-tree-item__content">
                                            <div className="pdx-tree-item__header"><a>{formatter ? formatter(item) : item}</a></div>
                                        </div>
                                    </div>)
                            }
                            </div>
                    }
                    {!data && isExpanded && <Spinner size="sm"/>}
                </div>
            </div>
}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    AddQueryParam    : QueryParamsActionsCreator.AddQueryParam,
    RemoveQueryParam : QueryParamsActionsCreator.RemoveQueryParam,
    SetUIRoutes      : PackageManagerActionsCreator.SetUIRoutes,
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager, QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(ExplorerItem)
