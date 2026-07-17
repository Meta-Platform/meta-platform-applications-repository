import * as React from "react"

import TaskMonitor from "../Containers/TaskMonitor.container"

// Instance Executor Panel — tela única (o monitor de instâncias/tarefas), sem
// barra superior (a própria janela já se chama "Instance Executor Control
// Panel"). O Launcher foi extraído para uma aplicação separada.
const ControlPanelPage = () =>
    <div className="eco-control-shell">
        <div className="eco-control-body" style={{ height: "100vh", paddingTop: 0, boxSizing: "border-box", overflow: "hidden" }}>
            <TaskMonitor/>
        </div>
    </div>

export default ControlPanelPage
