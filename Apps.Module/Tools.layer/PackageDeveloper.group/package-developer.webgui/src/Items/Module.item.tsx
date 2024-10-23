import * as React             from "react"
import {useEffect}            from "react"
import {List, Loader}         from "semantic-ui-react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import styled                 from "styled-components"

import QueryParamsActionsCreator    from "../Actions/QueryParams.actionsCreator"
import PackageManagerActionsCreator from "../Actions/PackageManager.actionsCreator"

import useExplorerItemState  from "../Hooks/useExplorerItemState"

//TODO Unificar
const ListItemStyled = styled(List.Item)`
    padding: 5px 10px 5px 10px!important;
    background-color: ${props => props.selected && "#f3f3f3"};
    &:hover{
        background-color: #f3f3f3;
    }
    
`

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

    return <ListItemStyled 
                selected={isSelected}
                onClick={handleChangeModule}>
                {title && <List.Icon name="box" />}
                <List.Content>
                    {title && <List.Header><a onClick={()=> setExpansion(!isExpanded)}>{title}</a></List.Header>}
                    {
                        (isExpanded || !title) && data && data.verifications && render(data.verifications)
                    }
                    {!data && <Loader size="mini" active inline/>}
                </List.Content>
            </ListItemStyled>
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
