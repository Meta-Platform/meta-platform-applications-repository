import * as React  from "react"
import { connect } from "react-redux"

import WorkspaceContainer from "../Containers/Workspace.container"

// Página raiz do My Workspace.
const WorkspacePage = ({ HTTPServerManager }:any) =>
    <WorkspaceContainer serverManagerInformation={HTTPServerManager}/>

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(WorkspacePage)
