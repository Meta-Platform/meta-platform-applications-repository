import * as React from "react"
import { connect } from "react-redux"
import { Icon } from "semantic-ui-react"

import usePackageTasks from "../Hooks/usePackageTasks"
import { pkgContext } from "../Utils/pkgContext"

const STATUS_CLASS:any = {
    RUNNING: "running", STOPPED: "stopped", ERROR: "error",
    STOPPING: "starting", STARTING: "starting", INSTALLING: "starting"
}

const Seg = ({ icon, children, title }:any) =>
    <span title={title} style={{display:"inline-flex", alignItems:"center", gap:5, padding:"0 10px", height:"100%", whiteSpace:"nowrap"}}>
        { icon && <Icon name={icon} style={{margin:0, fontSize:"0.9em", opacity:0.75}} /> }
        {children}
    </span>

// Barra de status inferior (estilo IDE): repo · pacote · tipo · runtime · execução
// · arquivo ativo · encoding. Lê o estado de execução do pacote ativo.
const WorkbenchStatusBar = ({ HTTPServerManager, pkg, activeTab, tabsCount, dirty }:any) => {
    const { status } = usePackageTasks({ HTTPServerManager, workspace: pkg.workspace, packageSelected: pkg })
    const ctx = pkgContext(pkg)

    const activePath = activeTab
        ? (activeTab.kind === "component" ? `${activeTab.file} · ${activeTab.detail.title}` : activeTab.filePath)
        : null
    const isCode = activeTab && activeTab.kind !== "component" && !/\.(json|md)$/i.test(activeTab.filePath || "")

    return <div style={{
        display:"flex", alignItems:"center", height:"var(--mp-shell-statusbar-h, 24px)", flexShrink:0,
        fontFamily:"var(--font-ui)", fontSize:"11px", color:"var(--color-text-inverse, #f4ead4)",
        background:"var(--mp-line-strong, #171713)", borderTop:"1px solid var(--color-border-strong, #25231f)"
    }}>
        <span style={{display:"inline-flex", alignItems:"center", gap:5, padding:"0 8px", height:"100%",
            background:ctx.color, color:"#0b0f16", fontWeight:700}}>
            <Icon name="database" style={{margin:0, fontSize:"0.9em"}} />{ctx.repo}
        </span>
        <Seg icon="cube" title="Módulo · Layer">{[ctx.module, ctx.layer].filter(Boolean).join(" · ") || "—"}</Seg>
        <span style={{opacity:0.25}}>|</span>
        <Seg icon="box" title="Pacote ativo"><strong>{pkg.name}</strong><span style={{opacity:0.6}}>.{pkg.ext}</span></Seg>

        <span style={{flex:1}} />

        { activePath && <Seg icon={dirty ? "circle" : "file outline"} title="Arquivo ativo">
            {activePath}{dirty ? " ●" : ""}
        </Seg> }
        { isCode && <Seg title="Codificação">UTF-8 · LF · Spaces: 4</Seg> }
        <Seg icon="folder open" title="Abas abertas">{tabsCount}</Seg>
        <Seg icon="microchip" title="Runtime">Node</Seg>
        <span className={`ide-status-pill ${STATUS_CLASS[status] || "unknown"}`}
            style={{height:16, margin:"0 8px", fontSize:"9.5px"}}>{status}</span>
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })
export default connect(mapStateToProps)(WorkbenchStatusBar)
