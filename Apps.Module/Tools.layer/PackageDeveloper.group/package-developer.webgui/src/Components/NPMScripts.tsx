import React                          from "react"
import { bindActionCreators }         from "redux"
import { connect }                    from "react-redux"
import {Button, Segment, Grid, Table, Icon} from "semantic-ui-react"
import styled from "styled-components"

const RowP10pxStyled = styled(Grid.Row)`
    padding : 10px!important;
`

type NPMScriptsModuleProps = {
    name    : string
    scripts : any
}

const NPMScriptsModule = ({
    name,
    scripts
}:NPMScriptsModuleProps) => 
    <Table celled striped size="small" compact>
        <Table.Header>
            <Table.Row>
                <Table.HeaderCell colSpan="3">{name}</Table.HeaderCell>
            </Table.Row>
        </Table.Header>
        <Table.Body>
            {
                Object.keys(scripts)
                .map((name:string, key:number) => 
                    <Table.Row key={key}>
                        <Table.Cell>{name}</Table.Cell>
                        <Table.Cell>{scripts[name]}</Table.Cell>
                        <Table.Cell collapsing>
                            <Button 
                                content = "Run"
                                size    = "mini" />
                        </Table.Cell>
                    </Table.Row>)
                }
        </Table.Body>
    </Table>
const NPMScripts = ({
    PackageManager
}:any) => {

    const {
        package_details,
        ui_details,
        web_details,
        lib_details
    } = PackageManager

    const hasAppScripts = package_details && package_details.packageJson && package_details.packageJson.scripts
    const hasUIScripts  = ui_details      && ui_details.packageJson      && ui_details.packageJson.scripts
    const hasWebScripts = web_details     && web_details.packageJson     && web_details.packageJson.scripts
    const hasLibScripts = lib_details     && lib_details.packageJson     && lib_details.packageJson.scripts

    return (
            hasAppScripts
           || hasUIScripts
           || hasWebScripts
           || hasLibScripts
        )
        ? <>
                {/*<h4>NPM Scripts</h4>*/}
                <Grid columns="equal">
                    { hasAppScripts && <RowP10pxStyled><NPMScriptsModule name="App" scripts={package_details.packageJson.scripts}/></RowP10pxStyled>}
                    { hasUIScripts  && <RowP10pxStyled><NPMScriptsModule name="UI"  scripts={ui_details.packageJson.scripts}/></RowP10pxStyled>}
                    { hasWebScripts && <RowP10pxStyled><NPMScriptsModule name="Web" scripts={web_details.packageJson.scripts}/></RowP10pxStyled>}
                    { hasLibScripts && <RowP10pxStyled><NPMScriptsModule name="Lib" scripts={lib_details.packageJson.scripts}/></RowP10pxStyled>}
                </Grid>      
            </>
        : <></>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager}:any) => ({
	PackageManager
})

export default connect(mapStateToProps, mapDispatchToProps)(NPMScripts)
