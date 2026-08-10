import * as React from "react"
import { connect } from "react-redux"

import LauncherContainer from "../Containers/Launcher.container"

// Aplicação Launcher — tela única. O esqueleto (barra de topo + área de
// conteúdo) é montado pelo AppShell do kit dentro do próprio container, porque
// a barra carrega a busca e as ações, que são estado da tela.
const ControlPanelPage = ({ HTTPServerManager }:any) =>
    <LauncherContainer serverManagerInformation={HTTPServerManager}/>

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(ControlPanelPage)
