import * as React from "react"
import { Icon } from "semantic-ui-react"

import { pkgContext } from "../Utils/pkgContext"

const TYPE_LABEL:any = {
    lib: "Biblioteca", cli: "CLI", service: "Serviço", webservice: "Web Service",
    webapp: "Web App", webgui: "Web GUI", app: "Aplicação", desktopapp: "Desktop App"
}

const Section = ({ title, children }:any) =>
    <div style={{marginBottom:14}}>
        <div className="ide-section-title" style={{marginBottom:6}}>{title}</div>
        {children}
    </div>

const Row = ({ label, children, mono }:any) =>
    <div style={{marginBottom:6}}>
        <div style={{fontSize:10, textTransform:"uppercase", letterSpacing:.4, opacity:.5}}>{label}</div>
        <div style={{fontSize:12.5, fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)", wordBreak:"break-all"}}>{children}</div>
    </div>

// Painel inspector (direita) — contexto do pacote/arquivo ativo + ações rápidas.
const Inspector = ({ pkg, activeTab, dirty, problems, onAction }:any) => {
    const ctx = pkgContext(pkg)
    const activePath = activeTab
        ? (activeTab.kind === "component" ? `${activeTab.file} · ${activeTab.detail.title}` : activeTab.filePath)
        : "—"

    return <div style={{
        width:300, flexShrink:0, overflow:"auto", padding:"12px 14px",
        borderLeft:"var(--mp-border)", background:"var(--color-panel-2, var(--mp-paper-2))",
        fontFamily:"var(--font-ui)"
    }} className="wb-scroll">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14}}>
            <span style={{width:12, height:12, borderRadius:3, background:ctx.color, flexShrink:0}} />
            <div style={{minWidth:0}}>
                <div style={{fontSize:15, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                    {pkg.name}<span style={{opacity:.55}}>.{pkg.ext}</span>
                </div>
                <div style={{fontSize:11, opacity:.6}}>{TYPE_LABEL[pkg.ext] || pkg.ext}</div>
            </div>
        </div>

        <Section title="Pacote">
            <Row label="Namespace" mono>@/{pkg.name}.{pkg.ext}</Row>
            <Row label="Repositório">{ctx.repo}</Row>
            { ctx.module && <Row label="Módulo">{ctx.module}</Row> }
            { ctx.layer && <Row label="Layer">{ctx.layer}</Row> }
            { ctx.group && <Row label="Grupo">{ctx.group}</Row> }
        </Section>

        <Section title="Arquivo ativo">
            <Row label="Caminho" mono>{activePath}</Row>
            <div style={{display:"flex", gap:6, marginTop:4}}>
                <span className={`ide-status-pill ${dirty ? "starting" : "running"}`} style={{height:18, fontSize:10}}>
                    {dirty ? "MODIFICADO" : "SALVO"}
                </span>
            </div>
        </Section>

        <Section title="Diagnóstico">
            <div style={{display:"flex", alignItems:"center", gap:8, fontSize:13}}>
                { problems.length === 0
                    ? <span style={{opacity:.75}}><Icon name="check circle" color="green" />Sem problemas</span>
                    : <span style={{cursor:"pointer"}} onClick={() => onAction && onAction("problems")}>
                        <Icon name="times circle" style={{color:"var(--color-danger, #d94a3f)"}} />
                        {problems.length} problema{problems.length > 1 ? "s" : ""}
                      </span> }
            </div>
        </Section>

        <Section title="Ações rápidas">
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
                { [
                    { k:"save",    icon:"save",      label:"Salvar" },
                    { k:"tasks",   icon:"tasks",     label:"Executar / Tasks" },
                    { k:"console", icon:"terminal",  label:"Console" }
                ].map((a) =>
                    <button key={a.k} className="ide-button" style={{width:"100%", justifyContent:"flex-start"}}
                        onClick={() => onAction && onAction(a.k)}>
                        <Icon name={a.icon as any} style={{margin:0}} />{a.label}
                    </button>) }
            </div>
        </Section>
    </div>
}

export default Inspector
