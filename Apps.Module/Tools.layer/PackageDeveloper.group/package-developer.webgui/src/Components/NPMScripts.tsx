import React                          from "react"
import { bindActionCreators }         from "redux"
import { connect }                    from "react-redux"
import { Button, DataTable, Panel }   from "@i-components"


type NPMScriptsModuleProps = {
    name    : string
    scripts : any
}

const NPMScriptsModule = ({
    name,
    scripts
}:NPMScriptsModuleProps) =>
    <Panel title={name}>
        <DataTable
            dense   = {true}
            rowKey  = {(row:any) => row.script}
            columns = {[
                { key: "script",  header: "Script" },
                { key: "command", header: "Comando", mono: true },
                {
                    key    : "run",
                    header : "",
                    width  : 1,
                    align  : "right" as const,
                    render : () => <Button size="sm">Run</Button>
                }
            ]}
            rows = {
                Object.keys(scripts)
                .map((script:string) => ({ script, command: scripts[script] }))
            }/>
    </Panel>

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
                <div className="pdx-npm-grid">
                    { hasAppScripts && <div className="pdx-npm-row"><NPMScriptsModule name="App" scripts={package_details.packageJson.scripts}/></div>}
                    { hasUIScripts  && <div className="pdx-npm-row"><NPMScriptsModule name="UI"  scripts={ui_details.packageJson.scripts}/></div>}
                    { hasWebScripts && <div className="pdx-npm-row"><NPMScriptsModule name="Web" scripts={web_details.packageJson.scripts}/></div>}
                    { hasLibScripts && <div className="pdx-npm-row"><NPMScriptsModule name="Lib" scripts={lib_details.packageJson.scripts}/></div>}
                </div>
            </>
        : <></>
}

const mapDispatchToProps = (dispatch:any) => bindActionCreators({}, dispatch)

const mapStateToProps = ({PackageManager}:any) => ({
	PackageManager
})

export default connect(mapStateToProps, mapDispatchToProps)(NPMScripts)
