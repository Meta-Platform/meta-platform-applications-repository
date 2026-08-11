import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Spinner, TreeRow } from "@i-components"

import GetRequestByServer from "../Utils/GetRequestByServer"
import { F_BOOT_SERVICE, F_SERVICE, F_BOOT_ENDPOINT, F_EG_ENDPOINT, F_EXECUTABLE, F_WINDOW } from "./metadataSchema"


const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Cor do ícone por família de componente (o kit pinta ícone de árvore em
// --mp-muted; a classe recupera o código de cores — ver batch-c.css).
const ICO = (color?:string) => color ? `pdx-ico-${color}` : ""

// Repassa a profundidade aos filhos declarados como JSX (a árvore é montada
// por composição; o recuo de cada nível vem da prop `depth` do TreeRow).
const withDepth = (children:any, depth:number) =>
    React.Children.toArray(children).map((child:any) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { depth }) : child)

// Nó colapsável. Caret expande/colapsa; clicar no rótulo seleciona (mostra
// detalhes no painel), se `detail` for fornecido.
const TreeNode = ({ icon, color, label, count, detail, onSelect, defaultOpen, selected, depth = 0, children }:any) => {
    const [open, setOpen] = useState(!!defaultOpen)
    const has = React.Children.count(children) > 0
    return <>
        <TreeRow
            depth={depth}
            icon={icon}
            className={ICO(color)}
            hasChildren={has}
            expanded={open}
            selected={selected}
            onToggle={() => setOpen(!open)}
            onSelect={() => detail && onSelect && onSelect(detail)}
            label={<span title={typeof label === "string" ? label : undefined}>
                {label}
                { count != null && <span className="pdx-ctree__count">({count})</span> }
            </span>} />
        { open && has && withDepth(children, depth + 1) }
    </>
}

const Leaf = ({ icon, color, title, subtitle, detail, onSelect, selected, depth = 0 }:any) =>
    <TreeRow
        depth={depth}
        icon={icon}
        className={ICO(color)}
        selected={selected}
        meta={subtitle ? <span title={subtitle}>{subtitle}</span> : undefined}
        onSelect={() => detail && onSelect && onSelect(detail)}
        label={<span title={title}>{title}</span>} />

// Comando (recursivo).
const CommandLeaf = ({ cmd, onSelect, depth = 0 }:any) => {
    const kids = Array.isArray(cmd.children) ? cmd.children : []
    const detail = { title: cmd.command || cmd.namespace, icon: "terminal", data: cmd, kind: "commands", path: ["commands"] }
    if(kids.length)
        return <TreeNode icon="terminal" color="teal" label={cmd.command || cmd.namespace} detail={detail} onSelect={onSelect} depth={depth}>
            { kids.map((c:any, i:number) => <CommandLeaf key={i} cmd={c} onSelect={onSelect} />) }
        </TreeNode>
    return <Leaf icon="terminal" color="teal" title={cmd.command || cmd.namespace} subtitle={cmd.description} detail={detail} onSelect={onSelect} depth={depth} />
}

// Árvore de componentes de um pacote (Boot / Services / Endpoints / Commands),
// carregada sob demanda. `onSelect(detail)` mostra os detalhes do item clicado.
const PackageComponentsTree = ({ HTTPServerManager, workspace, pkg, onSelect, selectedKey }:any) => {

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

    if(loading) return <div className="pdx-ctree__note"><Spinner size="sm" /></div>

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
        return <div className="pdx-ctree__note">sem boot / services / endpoints</div>

    // Anexa o arquivo-fonte ao detalhe (usado no modo edição para abrir o arquivo).
    const sel = (file:string) => (d:any) => onSelect && onSelect({ ...d, file })
    const bootSel = sel("/metadata/boot.json")
    const svcSel  = sel("/metadata/services.json")
    const egSel   = sel("/metadata/endpoint-group.json")
    const cgSel   = sel("/metadata/command-group.json")
    // Destaca o nó cuja (file#path) casa a aba ativa do editor.
    const SEL = (file:string, path:any[]) => !!selectedKey && selectedKey === `${file}#${(path || []).join(".")}`

    return <div className="pdx-ctree">
        {
            hasBoot &&
            <TreeNode icon="play" color="orange" label="Boot" defaultOpen selected={SEL("/metadata/boot.json", [])}
                detail={{ title:"Boot", icon:"play", data: boot, kind:"boot", path:[] }} onSelect={bootSel}>
                {
                    Array.isArray(boot.params) && boot.params.length > 0 &&
                    <TreeNode icon="sliders horizontal" color="grey" label="Params" count={boot.params.length} selected={SEL("/metadata/boot.json", ["params"])}
                        detail={{ title:"Boot · Params", icon:"sliders horizontal", data: boot.params, kind:"strings", path:["params"] }} onSelect={bootSel}>
                        { boot.params.map((p:string, i:number) => <Leaf key={i} icon="dot circle outline" color="grey" title={p}
                            detail={{ title:"Boot · Params", icon:"sliders horizontal", data: boot.params, kind:"strings", path:["params"] }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.executables) && boot.executables.length > 0 &&
                    <TreeNode icon="terminal" color="grey" label="Executables" count={boot.executables.length} selected={SEL("/metadata/boot.json", ["executables"])}
                        detail={{ title:"Boot · Executables", icon:"terminal", data: boot.executables, kind:"list", path:["executables"], fields: F_EXECUTABLE, emptyItem:{ executableName:"", dependency:"" } }} onSelect={bootSel}>
                        { boot.executables.map((e:any, i:number) => <Leaf key={i} icon="terminal" color="grey" title={e.executableName} subtitle={e.dependency} selected={SEL("/metadata/boot.json", ["executables", i])}
                            detail={{ title:`Executable · ${e.executableName}`, icon:"terminal", data: e, kind:"record", path:["executables", i], fields: F_EXECUTABLE }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.services) && boot.services.length > 0 &&
                    <TreeNode icon="cogs" color="green" label="Services" count={boot.services.length} selected={SEL("/metadata/boot.json", ["services"])}
                        detail={{ title:"Boot · Services", icon:"cogs", data: boot.services, kind:"list", path:["services"], fields: F_BOOT_SERVICE, emptyItem:{ namespace:"", dependency:"" } }} onSelect={bootSel}>
                        { boot.services.map((s:any, i:number) => <Leaf key={i} icon="cog" color="green" title={s.namespace} subtitle={s.dependency} selected={SEL("/metadata/boot.json", ["services", i])}
                            detail={{ title:`Service · ${s.namespace}`, icon:"cog", data: s, kind:"record", path:["services", i], fields: F_BOOT_SERVICE }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.endpoints) && boot.endpoints.length > 0 &&
                    <TreeNode icon="globe" color="blue" label="Endpoints" count={boot.endpoints.length} selected={SEL("/metadata/boot.json", ["endpoints"])}
                        detail={{ title:"Boot · Endpoints", icon:"globe", data: boot.endpoints, kind:"list", path:["endpoints"], fields: F_BOOT_ENDPOINT, emptyItem:{ dependency:"" } }} onSelect={bootSel}>
                        { boot.endpoints.map((e:any, i:number) => <Leaf key={i} icon="linkify" color="blue" title={e.dependency} selected={SEL("/metadata/boot.json", ["endpoints", i])}
                            detail={{ title:`Endpoint · ${e.dependency}`, icon:"linkify", data: e, kind:"record", path:["endpoints", i], fields: F_BOOT_ENDPOINT }} onSelect={bootSel} />) }
                    </TreeNode>
                }
                {
                    Array.isArray(boot.windows) && boot.windows.length > 0 &&
                    <TreeNode icon="window maximize outline" color="purple" label="Windows" count={boot.windows.length} selected={SEL("/metadata/boot.json", ["windows"])}
                        detail={{ title:"Boot · Windows", icon:"window maximize outline", data: boot.windows, kind:"list", path:["windows"], fields: F_WINDOW, emptyItem:{ title:"", dependency:"" } }} onSelect={bootSel}>
                        { boot.windows.map((w:any, i:number) => <Leaf key={i} icon="window maximize outline" color="purple" title={w.title} subtitle={w.url || w.dependency} selected={SEL("/metadata/boot.json", ["windows", i])}
                            detail={{ title:`Window · ${w.title}`, icon:"window maximize outline", data: w, kind:"record", path:["windows", i], fields: F_WINDOW }} onSelect={bootSel} />) }
                    </TreeNode>
                }
            </TreeNode>
        }
        {
            hasServices &&
            <TreeNode icon="cogs" color="green" label="Serviços" count={services.length} selected={SEL("/metadata/services.json", [])}
                detail={{ title:"Serviços", icon:"cogs", data: services, kind:"list", path:[], fields: F_SERVICE, emptyItem:{ namespace:"", path:"" } }} onSelect={svcSel}>
                { services.map((s:any, i:number) => <Leaf key={i} icon="cog" color="green" title={s.namespace} subtitle={s.path} selected={SEL("/metadata/services.json", [i])}
                    detail={{ title:`Serviço · ${s.namespace}`, icon:"cog", data: s, kind:"record", path:[i], fields: F_SERVICE }} onSelect={svcSel} />) }
            </TreeNode>
        }
        {
            hasEndpoints &&
            <TreeNode icon="globe" color="blue" label="Endpoints" count={eg.endpoints.length} selected={SEL("/metadata/endpoint-group.json", ["endpoints"])}
                detail={{ title:"Endpoints", icon:"globe", data: eg.endpoints, kind:"list", path:["endpoints"], fields: F_EG_ENDPOINT, emptyItem:{ url:"", type:"controller" } }} onSelect={egSel}>
                { eg.endpoints.map((e:any, i:number) => <Leaf key={i} icon="linkify" color="blue" title={e.url || e.dependency} subtitle={e.type} selected={SEL("/metadata/endpoint-group.json", ["endpoints", i])}
                    detail={{ title:`Endpoint · ${e.url || e.dependency}`, icon:"linkify", data: e, kind:"record", path:["endpoints", i], fields: F_EG_ENDPOINT }} onSelect={egSel} />) }
            </TreeNode>
        }
        {
            hasCommands &&
            <TreeNode icon="terminal" color="teal" label="Comandos" count={cg.commands.length} selected={SEL("/metadata/command-group.json", ["commands"])}
                detail={{ title:"Comandos", icon:"terminal", data: cg.commands, kind:"commands", path:["commands"] }} onSelect={cgSel}>
                { cg.commands.map((c:any, i:number) => <CommandLeaf key={i} cmd={c} onSelect={cgSel} />) }
            </TreeNode>
        }
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageComponentsTree)
