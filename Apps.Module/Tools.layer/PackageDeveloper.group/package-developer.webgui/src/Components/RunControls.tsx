import * as React from "react"
import { connect } from "react-redux"
import { Icon, Spinner } from "@i-components"

import usePackageTasks from "../Hooks/usePackageTasks"


// Botão de barra estilo IDE (`.pdx-toolbtn`, em Styles/components.css):
// neutro, discreto, com hover sutil e ícone colorido. Não é `IconButton` do kit
// porque o conteúdo alterna entre ícone e `Spinner`.

// Estado de execução → classe da pílula semântica (workbench.css).
const STATUS_CLASS:any = {
    RUNNING:    "running",
    STOPPED:    "stopped",
    ERROR:      "error",
    STOPPING:   "starting",
    STARTING:   "starting",
    INSTALLING: "starting"
}

// Barra de execução no topo do editor (estilo IDE): Run / Debug / Stop / Install
// + status. Sem o nome do pacote (fica destacado na barra superior principal).
const RunControls = ({ HTTPServerManager, packageSelected, workspace, onRun }:any) => {

    const { status, busy, install, start, debug, stop } =
        usePackageTasks({ HTTPServerManager, workspace, packageSelected })

    const isRunning = status === "RUNNING"
    const run = (fn:Function) => { onRun && onRun(); fn() }
    const glyph = (name:string, active:boolean, color:string, loading:boolean) =>
        loading ? <Spinner size="sm"/> : <Icon name={name as any} style={{ color: active ? color : undefined }} />

    return <div className="pdx-runbar">
        <button type="button" className="pdx-toolbtn" title="Run"   disabled={!!busy || isRunning} onClick={() => run(start)}>
            { glyph("play", !isRunning, "var(--mp-success)", busy === "start") }
        </button>
        <button type="button" className="pdx-toolbtn" title="Debug" disabled={!!busy || isRunning} onClick={() => run(debug)}>
            { glyph("bug", !isRunning, "var(--mp-accent-cyan)", busy === "debug") }
        </button>
        <button type="button" className="pdx-toolbtn" title="Stop"  disabled={!!busy || !isRunning} onClick={() => stop()}>
            { glyph("stop", isRunning, "var(--mp-danger)", busy === "stop") }
        </button>
        <span className="pdx-runbar__sep" />
        <button type="button" className="pdx-toolbtn" title="Instalar dependências" disabled={!!busy} onClick={() => install()}>
            { glyph("download", true, "var(--mp-muted)", busy === "install") }
        </button>
        <span className="pdx-runbar__spacer" />
        <span className={`ide-status-pill ${STATUS_CLASS[status] || "unknown"}`}>{status}</span>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(RunControls)
