import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Segment, List, Icon, Label, Header, Loader, Button } from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const Row = ({ icon, color, title, subtitle }:any) =>
    <List.Item>
        <List.Icon name={icon} color={color} />
        <List.Content>
            <List.Header>{title}</List.Header>
            { subtitle && <List.Description style={{wordBreak:"break-all"}}>{subtitle}</List.Description> }
        </List.Content>
    </List.Item>

const Group = ({ title, items }:any) =>
    (Array.isArray(items) && items.length > 0)
        ? <>
            <Header as="h5" style={{marginBottom:4}}>{title}</Header>
            <List divided relaxed>{items}</List>
          </>
        : null

// ----- Boot (metadata/boot.json) -----
const BootView = ({ boot }:any) => {
    if(!boot || boot.__error) return null
    return <Segment color="orange">
        <Header as="h4"><Icon name="play" />Boot</Header>
        {
            Array.isArray(boot.params) && boot.params.length > 0 &&
            <p><strong>Params: </strong>{boot.params.map((p:string) => <Label key={p} size="tiny">{p}</Label>)}</p>
        }
        <Group title="Executables" items={(boot.executables||[]).map((e:any, i:number) =>
            <Row key={i} icon="terminal" color="grey" title={e.executableName} subtitle={e.dependency} />)} />
        <Group title="Services" items={(boot.services||[]).map((s:any, i:number) =>
            <Row key={i} icon="cogs" color="green" title={s.namespace} subtitle={s.dependency} />)} />
        <Group title="Endpoints" items={(boot.endpoints||[]).map((e:any, i:number) =>
            <Row key={i} icon="globe" color="blue" title={e.dependency} />)} />
        <Group title="Windows" items={(boot.windows||[]).map((w:any, i:number) =>
            <Row key={i} icon="window maximize outline" color="purple" title={w.title} subtitle={w.url} />)} />
    </Segment>
}

// ----- Services (metadata/services.json) -----
const ServicesView = ({ services }:any) => {
    if(!Array.isArray(services) || services.length === 0) return null
    return <Segment color="green">
        <Header as="h4"><Icon name="cogs" />Services</Header>
        <List divided relaxed>
            { services.map((s:any, i:number) =>
                <Row key={i} icon="cog" color="green" title={s.namespace}
                    subtitle={`${s.path || ""}${Array.isArray(s["bound-params"]) ? "  ·  bound: " + s["bound-params"].join(", ") : ""}`} />) }
        </List>
    </Segment>
}

// ----- Endpoint Group (metadata/endpoint-group.json) -----
const EndpointsView = ({ eg }:any) => {
    const endpoints = eg && eg.endpoints
    if(!Array.isArray(endpoints) || endpoints.length === 0) return null
    return <Segment color="blue">
        <Header as="h4"><Icon name="globe" />Endpoint Group</Header>
        <List divided relaxed>
            { endpoints.map((e:any, i:number) =>
                <Row key={i} icon="linkify" color="blue" title={e.url || e.dependency} subtitle={e.type || e.dependency} />) }
        </List>
    </Segment>
}

// ----- Command Group (metadata/command-group.json), recursivo -----
const CommandNode = ({ cmd }:any) =>
    <List.Item>
        <List.Icon name="terminal" color="teal" />
        <List.Content>
            <List.Header>{cmd.command || cmd.namespace}</List.Header>
            { cmd.description && <List.Description>{cmd.description}</List.Description> }
            { Array.isArray(cmd.children) && cmd.children.length > 0 &&
                <List.List>{cmd.children.map((c:any, i:number) => <CommandNode key={i} cmd={c} />)}</List.List> }
        </List.Content>
    </List.Item>

const CommandsView = ({ cg }:any) => {
    const commands = cg && cg.commands
    if(!Array.isArray(commands) || commands.length === 0) return null
    return <Segment color="teal">
        <Header as="h4"><Icon name="terminal" />Command Group</Header>
        <List divided relaxed>{ commands.map((c:any, i:number) => <CommandNode key={i} cmd={c} />) }</List>
    </Segment>
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

    if(loading) return <Loader active inline="centered" />

    const m = metadata || {}
    const boot     = m["metadata/boot.json"]
    const services = m["metadata/services.json"]
    const eg       = m["metadata/endpoint-group.json"]
    const cg       = m["metadata/command-group.json"]
    const nothing  = !boot && !services && !eg && !cg

    return <div style={{maxHeight:"60vh", overflow:"auto"}}>
        <Button size="mini" basic icon="refresh" content="Recarregar" onClick={fetchMetadata} />
        {
            nothing
            ? <p style={{opacity:0.6, marginTop:10}}>Este pacote não possui boot / services / endpoint-group / command-group.</p>
            : <div style={{marginTop:10}}>
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
