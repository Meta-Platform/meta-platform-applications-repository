import React                  from "react"
import {useState, useEffect}  from "react"
import { bindActionCreators } from "redux"
import { connect }            from "react-redux"


import {
    Tab,
    Segment, 
    Icon,
    Header,
    Loader,
    Divider
} from "semantic-ui-react"

//import CodeEditor from "Packages/Components/CodeEditor"
/*
const CODE_EXAMPLE = `
{
    "compilerOptions": {
        "esModuleInterop":true,
        "sourceMap": true,
        "noImplicitAny": true,
        "module": "commonjs",
        "target": "es5",
        "jsx": "react",
        "lib":["esnext", "dom"],
        "types": ["react"],
        "baseUrl": ".",
        "paths": {
            "Packages/*" : ["*"]
        }
    }
}

`*/

import HeaderDetails   from "./Details.column/HeaderDetails"

import Functionalities from "../Components/Functionalities"
import NPMScripts      from "../Components/NPMScripts"
import Logs            from "../Components/Logs" 

import APIEditor    from "../Editors/API.editor"
import BootEditor   from "../Editors/Boot.editor"
import RoutesEditor from "../Editors/Routes.editor"

import TabPackageDetails from "../Components/TabPackageDetails"


type DetailsColumnProps = {
    workspace      : string
    PackageManager : any
    QueryParams    : any
}

const DetailsColumn = ({
    workspace,
    PackageManager,
    QueryParams
}:DetailsColumnProps) => {


    const {
        module,
        endpointName,
        item
    } = QueryParams

    const [_, endpointSummary] = endpointName ? endpointName.split(".") : []
    
    const {
        package_details,
        ui_details,
        ui_routes,
        web_details,
        lib_details
    } = PackageManager || {}

    const {
        name,
        //path,
    } = package_details || {}

    const {
        hasNodeModulesDir,
        hasUIDir,
        hasWebDir,
        hasLibDir,
        hasAppDataDir,
        hasBootFile
    } = package_details && package_details.verifications || {}

    const ifSummaryCollectionEquals = (summary:string) => endpointSummary && endpointSummary === summary
   
    return package_details 
    ? <>
        <HeaderDetails
            packageName  = {name}
            workspace = {workspace}
            path      = {package_details.path}/>
        <Divider/>
        <TabPackageDetails workspace={workspace}/>
        {
        !(
            hasNodeModulesDir
            || hasUIDir
            || hasWebDir
            || hasLibDir
            || hasAppDataDir
            || hasBootFile
        ) && <Segment placeholder>
                <Header icon>
                    <Icon name="file outline" />
                    No files for editing were found!
                </Header>
                <Segment.Inline>
                    The package is blank.
                </Segment.Inline>
            </Segment>}

        {ifSummaryCollectionEquals("GetAPIs") && <APIEditor/>}
        {ifSummaryCollectionEquals("GetBoot") && <BootEditor/>}
        {ifSummaryCollectionEquals("GetRoutes") && <RoutesEditor routes={ui_routes}/>}
        {/*<Segment>
            <CodeEditor value={CODE_EXAMPLE} language="json" />
        </Segment>*/}
        {/*<Segment>
            <Table celled striped>
                <Table.Header>
                <Table.Row>
                    <Table.HeaderCell colSpan="3">Git Repository</Table.HeaderCell>
                </Table.Row>
                </Table.Header>

                <Table.Body>
                <Table.Row>
                    <Table.Cell collapsing>
                    <Icon name="folder" /> node_modules
                    </Table.Cell>
                    <Table.Cell>Initial commit</Table.Cell>
                    <Table.Cell collapsing textAlign="right">
                    10 hours ago
                    </Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>
                    <Icon name="folder" /> test
                    </Table.Cell>
                    <Table.Cell>Initial commit</Table.Cell>
                    <Table.Cell textAlign="right">10 hours ago</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>
                    <Icon name="folder" /> build
                    </Table.Cell>
                    <Table.Cell>Initial commit</Table.Cell>
                    <Table.Cell textAlign="right">10 hours ago</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>
                    <Icon name="file outline" /> package.json
                    </Table.Cell>
                    <Table.Cell>Initial commit</Table.Cell>
                    <Table.Cell textAlign="right">10 hours ago</Table.Cell>
                </Table.Row>
                <Table.Row>
                    <Table.Cell>
                    <Icon name="file outline" /> Gruntfile.js
                    </Table.Cell>
                    <Table.Cell>Initial commit</Table.Cell>
                    <Table.Cell textAlign="right">10 hours ago</Table.Cell>
                </Table.Row>
                </Table.Body>
            </Table>
        </Segment>*/}
        
    </>
    : <Loader active inline="centered" />
}


const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager, QueryParams}:any) => ({
    PackageManager,
    QueryParams
})

export default connect(mapStateToProps, mapDispatchToProps)(DetailsColumn)
