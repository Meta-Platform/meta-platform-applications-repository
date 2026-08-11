import * as React from "react"
import { useEffect, useState } from "react"
import { connect } from "react-redux"
import { Banner, Spinner } from "@i-components"

import GetRequestByServer from "../../../Utils/GetRequestByServer"
import CopyableCodeValue from "../ui/CopyableCodeValue"
import { Badge, CollapsibleSection } from "../ui/Primitives"

// Rotas de um endpoint do tipo controller. O método HTTP e o caminho de cada
// rota vivem no api-template (src/APIs/*.api.json), não no endpoint-group.json —
// por isso o arquivo é lido SOB DEMANDA, só quando o endpoint é inspecionado.

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

type Props = {
    HTTPServerManager : any
    workspace   : string
    pkg         : { name:string, ext:string }
    apiTemplate : string          // ex.: "APIs/EcosystemManager.api.json"
    baseUrl?    : string          // rota do endpoint (prefixo das rotas do controller)
}

const METHOD_TONE:any = { GET: "get", POST: "post", PUT: "put", PATCH: "put", DELETE: "delete" }

const parse = (data:any):any => {
    if(data == null) return undefined
    if(typeof data === "object") return data
    try { return JSON.parse(String(data)) } catch(e) { return undefined }
}

const EndpointRoutes = ({ HTTPServerManager, workspace, pkg, apiTemplate, baseUrl }:Props) => {

    const [api, setApi]         = useState<any>()
    const [loading, setLoading] = useState(true)
    const [error, setError]     = useState<string | undefined>()

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(undefined)
        setApi(undefined)
        const service = GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")
        service.GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: `/src/${apiTemplate}` })
            .then(({ data }:any) => {
                if(cancelled) return
                const parsed = parse(data)
                if(!parsed) setError(`não foi possível ler src/${apiTemplate}`)
                setApi(parsed)
                setLoading(false)
            })
            .catch((e:any) => {
                if(cancelled) return
                setError((e && e.message) || String(e))
                setLoading(false)
            })
        return () => { cancelled = true }
    }, [workspace, pkg.name, pkg.ext, apiTemplate])

    if(loading) return <Spinner size="sm"/>
    if(error) return <Banner tone="warning">{error}</Banner>

    const endpoints = (api && Array.isArray(api.endpoints)) ? api.endpoints : []
    if(!endpoints.length) return null

    return <CollapsibleSection id={`routes-${apiTemplate}`} title="Rotas do controller"
        icon="exchange" count={endpoints.length}>
        <div className="pdx-tablewrap">
            <table className="pdx-table pdx-table--nowrap">
                <thead>
                    <tr><th>método</th><th>rota</th><th>função</th><th>parâmetros</th></tr>
                </thead>
                <tbody>
                    {
                        endpoints.map((route:any, i:number) => {
                            const params = Array.isArray(route.parameters) ? route.parameters : []
                            return <tr key={i} style={{cursor:"default"}}>
                                <td>
                                    { route.method &&
                                        <Badge tone="method" className={`pdx-method--${METHOD_TONE[route.method] || "other"}`}>
                                            {route.method}
                                        </Badge> }
                                </td>
                                <td className="pdx-mono">
                                    <CopyableCodeValue value={`${baseUrl || ""}${route.path || ""}`} type="path" />
                                </td>
                                <td className="pdx-mono">{route.summary || ""}</td>
                                <td>
                                    {
                                        params.length
                                        ? <span className="pdx-inline" style={{gap:4}}>
                                            {
                                                params.map((param:any, k:number) =>
                                                    <span key={k} className="pdx-why__chip"
                                                        title={`${param.name} (${param.in}${param.required ? ", obrigatório" : ""})`}>
                                                        {param.name}
                                                        <span className="pdx-why__field">:{param.in}</span>
                                                    </span>)
                                            }
                                          </span>
                                        : ""
                                    }
                                </td>
                            </tr>
                        })
                    }
                </tbody>
            </table>
        </div>
    </CollapsibleSection>
}

const mapStateToProps = ({ HTTPServerManager }:any) => ({ HTTPServerManager })

export default connect(mapStateToProps)(EndpointRoutes)
