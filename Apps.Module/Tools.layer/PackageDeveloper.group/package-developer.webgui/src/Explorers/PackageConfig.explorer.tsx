import * as React             from "react"
import {List}                 from "semantic-ui-react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"

import AppDataListItem from "../Components/AppData.listItem"
import ModuleItem      from "../Items/Module.item"
import ExplorerItem    from "../Items/Explorer.item"

import QueryParamsActionsCreator from "../Actions/QueryParams.actionsCreator"

const COMPONENT_MAPPER:any = {
    "AppDataListItem":AppDataListItem,
    "ModuleItem":ModuleItem,
    "ExplorerItem":ExplorerItem
}

const GetValueByValueConfig = (valueConfig:string, data:any) => {
    const levelsValueConfig = valueConfig.split(".")

    const getValue:any = (levelsValueConfig:Array<string>, data:any) => {
        const shallowerLevel = levelsValueConfig[0]
        const currentDataLevel = data[shallowerLevel]

        if(levelsValueConfig.length > 1)
            return getValue([...levelsValueConfig.filter(level => level !== shallowerLevel)], currentDataLevel)
        else
            return currentDataLevel
    }
    return getValue(levelsValueConfig, data)
}

const GetMappedProps = (propsMap:any, data:any) => Object
.keys(propsMap||{})
.reduce((mappedProps:any, propName:string) => 
            ({...mappedProps, [propName]:GetValueByValueConfig(propsMap[propName], data)}), {})

const RenderComponentByConfig = (config:any, data:any) => {
    const {
        ComponentName,
        Props,
        PropsMap,
        Children
    } = config
    
    const renderChildren = (childrenConfig:Array<any>) => (verifications:any) => {
        return <List.List>
        {
            childrenConfig
            .filter(({IfExist}:any) => verifications[IfExist])
            .map((childConfig, key) => RenderComponentByConfig(childConfig, {...data, key}))
        }
    </List.List>
    }
    
    const mappedProps = GetMappedProps(PropsMap, data)
    const renderProps = Children ? {render:renderChildren(Children)} :{}

    const props = {key:data.key, ...Props, ...mappedProps, ...renderProps}
    
    return React.createElement(COMPONENT_MAPPER[ComponentName], props, null)
}

type PackageConfigExplorerProps =
{
    data            : any
    configs         : Array<any>
    PackageManager  : any
}


const PackageConfigExplorer = ({
    configs,
    data,
    PackageManager
}:PackageConfigExplorerProps) => {

    const verifications = PackageManager.package_details 
    && PackageManager.package_details.verifications 
    || {}

    return <List>{
            configs
            .filter(({IfExist}:any) => !IfExist || verifications[IfExist])
            .map((config, key) => RenderComponentByConfig(config, {...data, key}))
        }</List>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({
    AddQueryParam : QueryParamsActionsCreator.AddQueryParam
}, dispatch)

const mapStateToProps = ({PackageManager}:any) => ({
    PackageManager
})

export default connect(mapStateToProps, mapDispatchToProps)(PackageConfigExplorer)