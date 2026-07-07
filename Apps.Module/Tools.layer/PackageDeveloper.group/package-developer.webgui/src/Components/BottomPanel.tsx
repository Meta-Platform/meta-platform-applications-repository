import * as React from "react"
import { useState } from "react"
import { connect } from "react-redux"
import { Icon, Loader } from "semantic-ui-react"

import usePackageTasks from "../Hooks/usePackageTasks"
import PackageConsole from "./PackageConsole"

const PANELS = [
    { key: "problems", label: "Problems", icon: "warning circle" },
    { key: "console",  label: "Console",  icon: "terminal" },
    { key: "output",   label: "Output",   icon: "list layout" },
    { key: "tasks",    label: "Tasks",    icon: "tasks" }
]

const Tab = ({ active, icon, label, badge, tone, onClick }:any) =>
    <div onClick={onClick} style={{
        display:"inline-flex", alignItems:"center", gap:6, padding:"0 12px", height:"100%", cursor:"pointer",
        fontFamily:"var(--font-ui)", fontSize:12, fontWeight: active ? 700 : 500,
        color: active ? "var(--mp-ink)" : "var(--color-text-muted, #63614f)",
        borderBottom: active ? "2px solid var(--color-accent, #13b8b2)" : "2px solid transparent"
    }}>
        <Icon name={icon} style={{margin:0}} />{label}
        { badge > 0 && <span className="ide-badge" style={tone === "warn" ? {background:"var(--color-warning, #d78a20)"} : undefined}>{badge}</span> }
    </div>

// Painel inferior estilo IDE: Problems / Console / Output / Tasks (com badges).
const BottomPanel = ({ HTTPServerManager, pkg, problems, open, mounted, onToggle }:any) => {
    const [tab, setTab] = useState("console")
    const { logs, status, busy, install, start, debug, stop } =
        usePackageTasks({ HTTPServerManager, workspace: pkg.workspace, packageSelected: pkg })

    const select = (k:string) => { setTab(k); if(!open) onToggle() }

    const TASKS = [
        { key:"install", label:"Instalar dependências", icon:"download", run:install },
        { key:"start",   label:"Executar (run)",        icon:"play",     run:start },
        { key:"debug",   label:"Debug",                 icon:"bug",      run:debug },
        { key:"stop",    label:"Parar",                 icon:"stop",     run:stop }
    ]

    return <div className="edit-run-dock" style={{flex:"0 0 auto"}}>
        <div style={{display:"flex", alignItems:"stretch", height:34, borderTop:"1px solid var(--mp-line-faint)"}}>
            {
                PANELS.map((pnl) =>
                    <Tab key={pnl.key} icon={pnl.icon} label={pnl.label}
                        active={open && tab === pnl.key}
                        badge={pnl.key === "problems" ? problems.length : 0} tone="warn"
                        onClick={() => select(pnl.key)} />)
            }
            <span style={{flex:1}} />
            <div onClick={onToggle} title={open ? "Recolher" : "Expandir"}
                style={{display:"inline-flex", alignItems:"center", padding:"0 12px", cursor:"pointer"}}>
                <Icon name={open ? "chevron down" : "chevron up"} style={{margin:0}} />
            </div>
        </div>
        {
            mounted &&
            <div style={{display: open ? "block" : "none", maxHeight:"46vh", overflow:"auto", padding:10}}>
                <div style={{display: tab === "console" ? "block" : "none"}}>
                    <PackageConsole key={pkg.path} workspace={pkg.workspace} packageSelected={pkg} terminalHeight="28vh" />
                </div>
                {
                    tab === "problems" &&
                    (problems.length === 0
                        ? <div style={{opacity:0.6, fontSize:13, padding:"8px 4px"}}><Icon name="check circle" color="green" />Nenhum problema detectado nos arquivos abertos.</div>
                        : <div>{ problems.map((p:any, i:number) =>
                            <div key={i} style={{display:"flex", alignItems:"center", gap:8, padding:"5px 4px", fontSize:13, borderBottom:"1px solid var(--mp-line-faint)"}}>
                                <Icon name="times circle" style={{color:"var(--color-danger, #d94a3f)", margin:0}} />
                                <strong>{p.file}</strong><span style={{opacity:0.75}}>{p.message}</span>
                            </div>) }</div>)
                }
                {
                    tab === "output" &&
                    <pre className="wb-scroll" style={{margin:0, maxHeight:"38vh", overflow:"auto", fontSize:12,
                        fontFamily:"var(--font-mono)", whiteSpace:"pre-wrap", opacity:0.9}}>
                        { (logs && logs.length) ? logs.map((l:any) => (typeof l === "string" ? l : (l.message || JSON.stringify(l)))).join("\n") : "— sem saída —" }
                    </pre>
                }
                {
                    tab === "tasks" &&
                    <div style={{display:"flex", flexDirection:"column", gap:6}}>
                        <div style={{fontSize:11, opacity:0.6, textTransform:"uppercase", letterSpacing:0.4}}>Estado: {status}</div>
                        {
                            TASKS.map((t) =>
                                <div key={t.key} onClick={() => !busy && t.run()} style={{
                                    display:"flex", alignItems:"center", gap:8, padding:"7px 10px", cursor: busy ? "default" : "pointer",
                                    border:"1px solid var(--mp-line-faint)", borderRadius:6, opacity: busy && busy !== t.key ? 0.5 : 1,
                                    background:"var(--color-surface, #fff8e8)"
                                }}>
                                    { busy === t.key ? <Loader active inline size="tiny" /> : <Icon name={t.icon as any} style={{margin:0}} /> }
                                    <span style={{fontSize:13, fontWeight:600}}>{t.label}</span>
                                </div>)
                        }
                    </div>
                }
            </div>
        }
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })
export default connect(mapStateToProps)(BottomPanel)
