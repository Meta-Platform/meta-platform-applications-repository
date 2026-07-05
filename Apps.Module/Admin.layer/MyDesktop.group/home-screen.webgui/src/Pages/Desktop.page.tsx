import * as React  from "react"
import { connect } from "react-redux"

import DesktopContainer from "../Containers/Desktop.container"

// Página raiz do MyDesktop. Injeta o catálogo de servidores em execução
// (HTTPServerManager) como serverManagerInformation para a área de trabalho.
const DesktopPage = ({ HTTPServerManager }:any) =>
    <DesktopContainer serverManagerInformation={HTTPServerManager}/>

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(DesktopPage)
