import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Badge, Button, ListRow, Panel, Spinner } from "@i-components"

import GetRequestByServer from "../Utils/GetRequestByServer"


const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Cor do ícone por família de componente (ver batch-c.css).
const ICO = (color?:string) => color ? `pdx-ico-${color}` : ""

const Row = ({ icon, color, title, subtitle }:any) =>
    <ListRow
        className={ICO(color)}
        icon={icon}
        title={title}
        meta={subtitle ? <span title={subtitle}>{subtitle}</span> : undefined} />

const Group = ({ title, items }:any) =>
    (Array.isArray(items) && items.length > 0)
        ? <div className="pdx-group">
            <h5 className="pdx-group__title">{title}</h5>
            <div>{items}</div>
          </div>
        : null

// ----- Boot (metadata/boot.json) -----
const BootView = ({ boot }:any) => {
    if(!boot || boot.__error) return null
    return <Panel title="Boot" icon="play" className={ICO("orange")}>
        {
            Array.isArray(boot.params) && boot.params.length > 0 &&
            <div className="pdx-params">
                <span className="pdx-params__label">Params:</span>
                { boot.params.map((p:string) => <Badge key={p}>{p}</Badge>) }
            </div>
        }
        <Group title="Executables" items={(boot.executables||[]).map((e:any, i:number) =>
            <Row key={i} icon="terminal" color="grey" title={e.executableName} subtitle={e.dependency} />)} />
        <Group title="Services" items={(boot.services||[]).map((s:any, i:number) =>
            <Row key={i} icon="cogs" color="green" title={s.namespace} subtitle={s.dependency} />)} />
        <Group title="Endpoints" items={(boot.endpoints||[]).map((e:any, i:number) =>
            <Row key={i} icon="globe" color="blue" title={e.dependency} />)} />
        <Group title="Windows" items={(boot.windows||[]).map((w:any, i:number) =>
            <Row key={i} icon="window maximize outline" color="purple" title={w.title} subtitle={w.url} />)} />
    </Panel>
}

// ----- Services (metadata/services.json) -----
const ServicesView = ({ services }:any) => {
    if(!Array.isArray(services) || services.length === 0) return null
    return <Panel title="Services" icon="cogs" className={ICO("green")}>
        { services.map((s:any, i:number) =>
            <Row key={i} icon="cog" color="green" title={s.namespace}
                subtitle={`${s.path || ""}${Array.isArray(s["bound-params"]) ? "  ·  bound: " + s["bound-params"].join(", ") : ""}`} />) }
    </Panel>
}

// ----- Endpoint Group (metadata/endpoint-group.json) -----
const EndpointsView = ({ eg }:any) => {
    const endpoints = eg && eg.endpoints
    if(!Array.isArray(endpoints) || endpoints.length === 0) return null
    return <Panel title="Endpoint Group" icon="globe" className={ICO("blue")}>
        { endpoints.map((e:any, i:number) =>
            <Row key={i} icon="linkify" color="blue" title={e.url || e.dependency} subtitle={e.type || e.dependency} />) }
    </Panel>
}

// ----- Command Group (metadata/command-group.json), recursivo -----
const CommandNode = ({ cmd }:any) => <>
    <Row icon="terminal" color="teal" title={cmd.command || cmd.namespace} subtitle={cmd.description} />
    {
        Array.isArray(cmd.children) && cmd.children.length > 0 &&
        <div className="pdx-nest">{ cmd.children.map((c:any, i:number) => <CommandNode key={i} cmd={c} />) }</div>
    }
</>

const CommandsView = ({ cg }:any) => {
    const commands = cg && cg.commands
    if(!Array.isArray(commands) || commands.length === 0) return null
    return <Panel title="Command Group" icon="terminal" className={ICO("teal")}>
        { commands.map((c:any, i:number) => <CommandNode key={i} cmd={c} />) }
    </Panel>
}

const PackageComponents = ({ HTTPServerManager, packageSelected, workspace }:any) => {

    const [metadata, setMetadata] = useState<any>()
    const [loading, setLoading]   = useState(false)

    const api = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")

    const fetchMetadata = () => {
        setLoading(true)
        api.GetPackageMetadata({ workspace, packageName: packageSelected.name, ext: packageSelected.ext })
            .then(({data}:any) => setMetadata(data || {}))
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchMetadata() }, [workspace, packageSelected && packageSelected.name, packageSelected && packageSelected.ext])

    if(loading) return <div className="pdx-loading"><Spinner /></div>

    const m = metadata || {}
    const boot     = m["metadata/boot.json"]
    const services = m["metadata/services.json"]
    const eg       = m["metadata/endpoint-group.json"]
    const cg       = m["metadata/command-group.json"]
    const nothing  = !boot && !services && !eg && !cg

    return <div className="pdx-components">
        <Button size="sm" icon="refresh" onClick={fetchMetadata}>Recarregar</Button>
        {
            nothing
            ? <p className="pdx-components__empty">Este pacote não possui boot / services / endpoint-group / command-group.</p>
            : <div className="pdx-components__panels">
                <BootView boot={boot} />
                <ServicesView services={services} />
                <EndpointsView eg={eg} />
                <CommandsView cg={cg} />
              </div>
        }
    </div>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageComponents)
