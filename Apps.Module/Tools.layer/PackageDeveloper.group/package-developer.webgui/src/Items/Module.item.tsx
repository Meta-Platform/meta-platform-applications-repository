import * as React             from "react"
import {useEffect}            from "react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"

import { Icon, Spinner, QueryParamsActionsCreator } from "@i-components"
import PackageManagerActionsCreator from "../Actions/PackageManager.actionsCreator"

import useExplorerItemState  from "../Hooks/useExplorerItemState"


type ModuleItemProps =
{
    title             ?: string
	workspace          : string
	packageName        : string
    ext                : string
    serverName         : string
    apiName            : string
    expanded          ?: boolean
    render             : any
    HTTPServerManager  : any
    QueryParams        : any
    AddQueryParam      : Function
    RemoveQueryParam   : Function
    SetUIDetails       : Function
    SetWebDetails      : Function
    SetLibDetails      : Function
}

const ModuleItem = ({
    title,
    workspace,
    packageName,
    ext,
    serverName,
    apiName,
    render,
    expanded,
    HTTPServerManager,
    QueryParams,
    AddQueryParam,
    RemoveQueryParam,
    SetUIDetails,
    SetWebDetails,
    SetLibDetails
}:ModuleItemProps) => {

    const { data, isExpanded, setExpansion} = useExplorerItemState({
        workspace,
        packageName,
        ext,
        serverName,
        apiName,
        expanded,
        summary:"GetDetails",
        HTTPServerManager})

        useEffect(() => {
            if(QueryParams.module && QueryParams.module === `${apiName}.GetDetails`){
                setExpansion(true)
            }
        }, [QueryParams.module])

        useEffect(() => {
            if(data){
                switch(apiName){
                    case "WebguiExplorer":
                        SetUIDetails(data)
                    break
                    case "WebserviceExplorer":
                        SetWebDetails(data)
                    break
                    case "LibraryExplorer":
                        SetLibDetails(data)
                    break
                    default:
                        console.error(`apiName [${apiName}] don't exist!`)
                }
            }
        }, [data])


    const isSelected = !!(QueryParams.module && QueryParams.module === `${apiName}.GetDetails`)

    //TODO Quase OK falta pouco
    /*
    useEffect(()=>{
        if(QueryParams.module && QueryParams.endpointName){
            const [apiName]  = QueryParams.module.split(".")
            const [apiName_] = QueryParams.endpointName.split(".")
            if(apiName !== apiName_){
                RemoveQueryParam("endpointName")
            }
        }
    }, [QueryParams])
    */

    const handleChangeModule = () => {
        AddQueryParam("module", `${apiName}.GetDetails`)
    }

    return <div
                className={`pdx-tree-item pdx-module-item ${isSelected ? "is-selected" : ""}`.trim()}
                onClick={handleChangeModule}>
                {title && <Icon name="box" className="pdx-tree-item__icon"/>}
                <div className="pdx-tree-item__content">
                    {title && <div className="pdx-tree-item__header"><a onClick={()=> setExpansion(!isExpanded)}>{title}</a></div>}
                    {
                        (isExpanded || !title) && data && data.verifications && render(data.verifications)
                    }
                    {!data && <Spinner size="sm"/>}
                </div>
            </div>
}

const mapDispatchToProps = (dispatch:any) =>
 bindActionCreators({
    RemoveQueryParam : QueryParamsActionsCreator.RemoveQueryParam,
    AddQueryParam    : QueryParamsActionsCreator.AddQueryParam,
    SetUIDetails     : PackageManagerActionsCreator.SetUIDetails,
    SetWebDetails    : PackageManagerActionsCreator.SetWebDetails,
    SetLibDetails    : PackageManagerActionsCreator.SetLibDetails
}, dispatch)

const mapStateToProps = ({HTTPServerManager, QueryParams}:any) => ({
	HTTPServerManager, QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(ModuleItem)
