import * as React             from "react"
import {useEffect}            from "react"
import {List, Loader}         from "semantic-ui-react"
import { connect }            from "react-redux"
import { bindActionCreators } from "redux"
import styled                 from "styled-components"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"
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

//TODO Unificar
const ListItemStyled_ = styled(List.Item)`
    padding: 5px 10px 5px 10px!important;
    background-color: ${props => props.selected && "#e0e0e0"};
    &:hover{
        background-color: #e0e0e0;
    }
`
const ListItemStyled__ = styled(List.Item)`
    padding: 5px 10px 5px 10px!important;
    background-color: ${props => props.selected && "#cecece"};
    &:hover{
        background-color: #cecece;
    }
`

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

    return <ListItemStyled_ 
                selected={isSelected}
                onClick={handleChangeCollection}>
                <List.Icon name={iconItem} />
                <List.Content>
                    <List.Header><a onClick={()=> setExpansion(!isExpanded)}>{title} {data && data.length > 0 && `(${data.length})`}</a>{!data && !isExpanded && <Loader size="mini" active inline/>}</List.Header>
                    {
                        data
                        && isExpanded
                        && <List.List>
                            {
                                data
                                .map((item:any, key:any) =>
                                    <ListItemStyled__ 
                                        key={key} 
                                        selected={
                                            isSelected 
                                            && !!(
                                                QueryParams.item 
                                                && QueryParams.item === `${summary}.${formatter ? formatter(item) : item}`)}
                                        onClick={() => AddQueryParam("item", `${summary}.${formatter ? formatter(item) : item}`)}>
                                        <List.Icon name={iconSubItem} />
                                        <List.Content>
                                            <List.Header><a>{formatter ? formatter(item) : item}</a></List.Header>
                                        </List.Content>
                                    </ListItemStyled__>)   
                            }
                            </List.List>
                    }
                    {!data && isExpanded && <Loader size="mini" active inline/>}
                </List.Content>
            </ListItemStyled_>
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
