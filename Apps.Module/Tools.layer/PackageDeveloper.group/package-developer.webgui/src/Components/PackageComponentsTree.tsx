import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { List, Icon, Loader } from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Nó colapsável. Caret expande/colapsa; clicar no rótulo seleciona (mostra
// detalhes no painel), se `detail` for fornecido.
const TreeNode = ({ icon, color, label, count, detail, onSelect, defaultOpen, children }:any) => {
    const [open, setOpen] = useState(!!defaultOpen)
    const has = React.Children.count(children) > 0
    return <List.Item>
        <List.Icon name={has ? (open ? "caret down" : "caret right") : "circle outline"}
            color={has ? undefined : "grey"} link={has}
            style={{cursor: has ? "pointer" : "default"}} onClick={() => has && setOpen(!open)} />
        <List.Content style={{minWidth:0, overflow:"hidden"}}>
            <List.Header title={typeof label === "string" ? label : undefined}
                style={{cursor:"pointer", fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}
                onClick={() => detail && onSelect && onSelect(detail)}>
                <Icon name={icon} color={color} />{label}
                { count != null && <span style={{opacity:0.5, marginLeft:6, fontWeight:400}}>({count})</span> }
            </List.Header>
            { open && has && <List.List style={{paddingLeft:6}}>{children}</List.List> }
        </List.Content>
    </List.Item>
}

const nowrap:any = { whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", display:"block", maxWidth:"100%" }

const Leaf = ({ icon, color, title, subtitle, detail, onSelect }:any) =>
    <List.Item style={{cursor:"pointer"}} onClick={() => detail && onSelect && onSelect(detail)}>
        <List.Icon name={icon} color={color} />
        <List.Content style={{minWidth:0, overflow:"hidden"}}>
            <List.Header title={title} style={{fontWeight:400, ...nowrap}}>{title}</List.Header>
            { subtitle && <List.Description title={subtitle} style={{fontSize:"0.82em", opacity:0.75, ...nowrap}}>{subtitle}</List.Description> }
        </List.Content>
    </List.Item>

// Comando (recursivo).
const CommandLeaf = ({ cmd, onSelect }:any) => {
    const kids = Array.isArray(cmd.children) ? cmd.children : []
    const detail = { title: cmd.command || cmd.namespace, icon: "terminal", data: cmd }
    if(kids.length)
        return <TreeNode icon="terminal" color="teal" label={cmd.command || cmd.namespace} detail={detail} onSelect={onSelect}>
            { kids.map((c:any, i:number) => <CommandLeaf key={i} cmd={c} onSelect={onSelect} />) }
        </TreeNode>
    return <Leaf icon="terminal" color="teal" title={cmd.command || cmd.namespace} subtitle={cmd.description} detail={detail} onSelect={onSelect} />
}

// Árvore de componentes de um pacote (Boot / Services / Endpoints / Commands),
// carregada sob demanda. `onSelect(detail)` mostra os detalhes do item clicado.
const PackageComponentsTree = ({ HTTPServerManager, workspace, pkg, onSelect }:any) => {

    const [metadata, setMetadata] = useState<any>()
    const [loading, setLoading]   = useState(true)

    const api = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")

    useEffect(() => {
        setLoading(true)
        api.GetPackageMetadata({ workspace, packageName: pkg.name, ext: pkg.ext })
            .then(({data}:any) => setMetadata(data || {}))
            .catch(() => setMetadata({}))
            .finally(() => setLoading(false))
    }, [workspace, pkg.name, pkg.ext, pkg.path])

    if(loading) return <List.Item><Loader active inline size="tiny" /></List.Item>

    const m = metadata || {}
    const boot = m["metadata/boot.json"]
    const services = m["metadata/services.json"]
    const eg = m["metadata/endpoint-group.json"]
    const cg = m["metadata/command-group.json"]

    const hasBoot = boot && !boot.__error
    const hasServices = Array.isArray(services) && services.length > 0
    const hasEndpoints = eg && Array.isArray(eg.endpoints) && eg.endpoints.length > 0
    const hasCommands = cg && Array.isArray(cg.commands) && cg.commands.length > 0

    if(!hasBoot && !hasServices && !hasEndpoints && !hasCommands)
        return <List.Item><span style={{opacity:0.45, fontSize:"0.85em"}}>sem boot / services / endpoints</span></List.Item>

    // Anexa o arquivo-fonte ao detalhe (usado no modo edição para abrir o arquivo).
    const sel = (file:string) => (d:any) => onSelect && onSelect({ ...d, file })
    const bootSel = sel("/metadata/boot.json")
    const svcSel  = sel("/metadata/services.json")
    const egSel   = sel("/metadata/endpoint-group.json")
    const cgSel   = sel("/metadata/command-group.json")

    return <>
        {
            hasBoot &&
            <TreeNode icon="play" color="orange" label="Boot" defaultOpen
                detail={{ title:"Boot", icon:"play", data: boot }} onSelect={bootSel}>
                {
                    Array.isArray(boot.params) && boot.params.length > 0 &&
                    <TreeNode icon="sliders horizontal" color="grey" label="Params" count={boot.params.length}
                        detail={{ title:"Boot · Params", icon:"sliders horizontal", data: boot.params }} onSelect={bootSel}>
                        { boot.params.map((p:string, i:number) => <Leaf key={i} icon="dot circle outline" color="grey" title={p}
                            detail={{ title:`Param · ${p}`, icon:"dot circle outline", data: { param: p } }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.executables) && boot.executables.length > 0 &&
                    <TreeNode icon="terminal" color="grey" label="Executables" count={boot.executables.length}
                        detail={{ title:"Boot · Executables", icon:"terminal", data: boot.executables }} onSelect={bootSel}>
                        { boot.executables.map((e:any, i:number) => <Leaf key={i} icon="terminal" color="grey" title={e.executableName} subtitle={e.dependency}
                            detail={{ title:`Executable · ${e.executableName}`, icon:"terminal", data: e }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.services) && boot.services.length > 0 &&
                    <TreeNode icon="cogs" color="green" label="Services" count={boot.services.length}
                        detail={{ title:"Boot · Services", icon:"cogs", data: boot.services }} onSelect={bootSel}>
                        { boot.services.map((s:any, i:number) => <Leaf key={i} icon="cog" color="green" title={s.namespace} subtitle={s.dependency}
                            detail={{ title:`Service · ${s.namespace}`, icon:"cog", data: s }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.endpoints) && boot.endpoints.length > 0 &&
                    <TreeNode icon="globe" color="blue" label="Endpoints" count={boot.endpoints.length}
                        detail={{ title:"Boot · Endpoints", icon:"globe", data: boot.endpoints }} onSelect={bootSel}>
                        { boot.endpoints.map((e:any, i:number) => <Leaf key={i} icon="linkify" color="blue" title={e.dependency}
                            detail={{ title:`Endpoint · ${e.dependency}`, icon:"linkify", data: e }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.windows) && boot.windows.length > 0 &&
                    <TreeNode icon="window maximize outline" color="purple" label="Windows" count={boot.windows.length}
                        detail={{ title:"Boot · Windows", icon:"window maximize outline", data: boot.windows }} onSelect={bootSel}>
                        { boot.windows.map((w:any, i:number) => <Leaf key={i} icon="window maximize outline" color="purple" title={w.title} subtitle={w.url || w.dependency}
                            detail={{ title:`Window · ${w.title}`, icon:"window maximize outline", data: w }} onSelect={bootSel} />) }
                    </TreeNode>
                }
            </TreeNode>
        }
        {
            hasServices &&
            <TreeNode icon="cogs" color="green" label="Serviços" count={services.length}
                detail={{ title:"Serviços", icon:"cogs", data: services }} onSelect={svcSel}>
                { services.map((s:any, i:number) => <Leaf key={i} icon="cog" color="green" title={s.namespace} subtitle={s.path}
                    detail={{ title:`Serviço · ${s.namespace}`, icon:"cog", data: s }} onSelect={svcSel} />) }
            </TreeNode>
        }
        {
            hasEndpoints &&
            <TreeNode icon="globe" color="blue" label="Endpoints" count={eg.endpoints.length}
                detail={{ title:"Endpoints", icon:"globe", data: eg.endpoints }} onSelect={egSel}>
                { eg.endpoints.map((e:any, i:number) => <Leaf key={i} icon="linkify" color="blue" title={e.url || e.dependency} subtitle={e.type}
                    detail={{ title:`Endpoint · ${e.url || e.dependency}`, icon:"linkify", data: e }} onSelect={egSel} />) }
            </TreeNode>
        }
        {
            hasCommands &&
            <TreeNode icon="terminal" color="teal" label="Comandos" count={cg.commands.length}
                detail={{ title:"Comandos", icon:"terminal", data: cg.commands }} onSelect={cgSel}>
                { cg.commands.map((c:any, i:number) => <CommandLeaf key={i} cmd={c} onSelect={cgSel} />) }
            </TreeNode>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageComponentsTree)
