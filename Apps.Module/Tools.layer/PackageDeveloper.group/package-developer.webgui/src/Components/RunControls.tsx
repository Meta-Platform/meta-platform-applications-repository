import * as React from "react"
import { connect } from "react-redux"
import { Icon, Loader } from "semantic-ui-react"
import styled from "styled-components"

import usePackageTasks from "../Hooks/usePackageTasks"

// Botão de barra estilo IDE: neutro, discreto, com hover sutil e ícone colorido.
const ToolBtn = styled.button<{disabled?:boolean}>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--mp-text-secondary, #9aa4b2);
    cursor: pointer;
    transition: background .12s ease, border-color .12s ease;
    &:hover:not(:disabled) { background: var(--mp-panel-raised, rgba(127,127,127,.14)); border-color: var(--mp-line-faint, rgba(127,127,127,.3)); }
    &:disabled { opacity: .4; cursor: default; }
    & > i.icon { margin: 0 !important; font-size: 15px; }
`

const StatusPill = styled.span<{tone:string}>`
    font-size: .72em;
    font-weight: 700;
    letter-spacing: .04em;
    padding: 2px 9px;
    border-radius: 10px;
    text-transform: uppercase;
    color: ${(p:any) => p.tone};
    background: rgba(127,127,127,.12);
    border: 1px solid rgba(127,127,127,.28);
`

const TONE:any = {
    RUNNING:  "var(--mp-success, #2ecc71)",
    STOPPED:  "var(--mp-text-muted, #7c8795)",
    ERROR:    "var(--mp-danger, #e0576b)",
    STOPPING: "var(--mp-warning, #e8a13a)"
}

// Barra de execução no topo do editor (estilo IDE): Run / Debug / Stop / Install
// + status. Sem o nome do pacote (fica destacado na barra superior principal).
const RunControls = ({ HTTPServerManager, packageSelected, workspace, onRun }:any) => {

    const { status, busy, install, start, debug, stop } =
        usePackageTasks({ HTTPServerManager, workspace, packageSelected })

    const isRunning = status === "RUNNING"
    const run = (fn:Function) => { onRun && onRun(); fn() }
    const glyph = (name:string, active:boolean, color:string, loading:boolean) =>
        loading ? <Loader active inline size="tiny" /> : <Icon name={name as any} style={{ color: active ? color : undefined }} />

    return <div style={{
        display:"flex", alignItems:"center", gap:4, padding:"6px 12px", flexShrink:0,
        borderBottom:"1px solid var(--mp-line-faint)", background:"var(--mp-panel-alt, transparent)"
    }}>
        <ToolBtn title="Run"   disabled={!!busy || isRunning} onClick={() => run(start)}>
            { glyph("play", !isRunning, "var(--mp-success, #2ecc71)", busy === "start") }
        </ToolBtn>
        <ToolBtn title="Debug" disabled={!!busy || isRunning} onClick={() => run(debug)}>
            { glyph("bug", !isRunning, "var(--mp-accent, #14D6C8)", busy === "debug") }
        </ToolBtn>
        <ToolBtn title="Stop"  disabled={!!busy || !isRunning} onClick={() => stop()}>
            { glyph("stop", isRunning, "var(--mp-danger, #e0576b)", busy === "stop") }
        </ToolBtn>
        <span style={{width:1, height:18, background:"var(--mp-line-faint)", margin:"0 6px"}} />
        <ToolBtn title="Instalar dependências" disabled={!!busy} onClick={() => install()}>
            { glyph("download", true, "var(--mp-text-secondary, #9aa4b2)", busy === "install") }
        </ToolBtn>
        <span style={{flex:1}} />
        <StatusPill tone={TONE[status] || TONE.STOPPED}>{status}</StatusPill>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(RunControls)
