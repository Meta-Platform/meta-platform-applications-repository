import * as React from "react"
import { connect } from "react-redux"

import LauncherContainer from "../Containers/Launcher.container"

// Aplicação Launcher — tela única, sem barra superior (a própria janela já se
// chama "Launcher"). Lista repositórios/pacotes, mostra árvore + detalhes +
// diagrama de dependências e lança pacotes.
const ControlPanelPage = ({ HTTPServerManager }:any) =>
    <div className="eco-control-shell">
        <div className="eco-control-body" style={{ height: "100vh", paddingTop: 0, boxSizing: "border-box", overflow: "hidden" }}>
            <LauncherContainer serverManagerInformation={HTTPServerManager}/>
        </div>
    </div>

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(ControlPanelPage)
