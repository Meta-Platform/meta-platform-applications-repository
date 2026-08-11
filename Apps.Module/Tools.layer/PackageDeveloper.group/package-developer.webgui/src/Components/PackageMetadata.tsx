import * as React from "react"
import { useState, useEffect } from "react"
import { connect } from "react-redux"
import { Button, Spinner, TreeRow } from "@i-components"

import GetRequestByServer from "../Utils/GetRequestByServer"


const SERVER_APP_NAME = process.env.SERVER_APP_NAME

const isBranch = (value:any) => value !== null && typeof value === "object"

type NodeProps = { label:string, value:any, depth:number }

// Nó recursivo da árvore de metadata (objeto/array expansível, primitivo inline).
const JsonNode = ({ label, value, depth }:NodeProps) => {

    const [open, setOpen] = useState(depth < 1)

    if(!isBranch(value)){
        return <TreeRow
            depth={depth}
            icon="code"
            className="pdx-ico-grey"
            label={<span>
                <span className="pdx-json__key">{label}:</span>{" "}
                <strong className="pdx-json__value">{JSON.stringify(value)}</strong>
            </span>} />
    }

    const isArray = Array.isArray(value)
    const entries:any[] = isArray
        ? value.map((v:any, i:number) => [i, v])
        : Object.entries(value)

    return <>
        <TreeRow
            depth={depth}
            icon={isArray ? "list ol" : "folder"}
            className={isArray ? "pdx-ico-teal" : "pdx-ico-yellow"}
            hasChildren
            expanded={open}
            onToggle={() => setOpen(!open)}
            onSelect={() => setOpen(!open)}
            label={<span>
                {label} <span className="pdx-json__size">{isArray ? `[${entries.length}]` : `{${entries.length}}`}</span>
            </span>} />
        {
            open && entries.map(([k, v]:any) =>
                <JsonNode key={String(k)} label={String(k)} value={v} depth={depth + 1} />)
        }
    </>
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
        <Button size="sm" icon="refresh" onClick={fetchMetadata}>Recarregar</Button>
        {
            loading
            ? <div className="pdx-loading"><Spinner /></div>
            : names.length === 0
                ? <p className="pdx-json__empty">Nenhum metadado encontrado.</p>
                : <div className="pdx-json">
                    { names.map((name:string) => <JsonNode key={name} label={name} value={metadata[name]} depth={0} />) }
                  </div>
        }
    </>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(PackageMetadata)
