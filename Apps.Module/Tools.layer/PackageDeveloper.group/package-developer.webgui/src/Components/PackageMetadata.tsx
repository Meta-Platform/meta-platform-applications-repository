import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { List, Icon, Loader, Button } from "semantic-ui-react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const isBranch = (value:any) => value !== null && typeof value === "object"

type NodeProps = { label:string, value:any, depth:number }

// Nó recursivo da árvore de metadata (objeto/array expansível, primitivo inline).
const JsonNode = ({ label, value, depth }:NodeProps) => {

    const [open, setOpen] = useState(depth < 1)

    if(!isBranch(value)){
        return <List.Item>
            <List.Icon name="code" color="grey" />
            <List.Content>
                <span style={{color:"#888"}}>{label}:</span>{" "}
                <strong style={{color:"#2185d0"}}>{JSON.stringify(value)}</strong>
            </List.Content>
        </List.Item>
    }

    const isArray = Array.isArray(value)
    const entries:any[] = isArray
        ? value.map((v:any, i:number) => [i, v])
        : Object.entries(value)

    return <List.Item>
        <List.Icon name={open ? "caret down" : "caret right"} link onClick={() => setOpen(!open)} />
        <List.Content>
            <List.Header style={{cursor:"pointer"}} onClick={() => setOpen(!open)}>
                <Icon name={isArray ? "list ol" : "folder"} color={isArray ? "teal" : "yellow"} />
                {label} <span style={{opacity:0.5}}>{isArray ? `[${entries.length}]` : `{${entries.length}}`}</span>
            </List.Header>
            {
                open && <List.List>
                    { entries.map(([k, v]:any) => <JsonNode key={String(k)} label={String(k)} value={v} depth={depth + 1} />) }
                </List.List>
            }
        </List.Content>
    </List.Item>
}

const PackageMetadata = ({ HTTPServerManager, packageSelected, workspace }:any) => {

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

    const names = metadata ? Object.keys(metadata) : []

    return <>
        <Button size="mini" basic icon="refresh" content="Recarregar" onClick={fetchMetadata} />
        {
            loading
            ? <Loader active inline="centered" />
            : names.length === 0
                ? <p style={{opacity:0.6, marginTop:10}}>Nenhum metadado encontrado.</p>
                : <List style={{maxHeight:"58vh", overflow:"auto", marginTop:10}}>
                    { names.map((name:string) => <JsonNode key={name} label={name} value={metadata[name]} depth={0} />) }
                  </List>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageMetadata)
