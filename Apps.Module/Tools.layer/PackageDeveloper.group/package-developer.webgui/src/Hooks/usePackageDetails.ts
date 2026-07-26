import { useEffect, useRef, useState } from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"
import { PackageModel, buildPackageModel } from "../Domain/packageModel"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Detalhe do pacote selecionado: metadados completos (o índice traz só os de
// capacidade) e README sob demanda.
//
// Resposta obsoleta NUNCA substitui a seleção atual: cada carga carrega um token
// e só aplica o resultado se ainda for a seleção corrente. Trocar de pacote
// rápido não deixa conteúdo do anterior na tela.

type Params = {
    HTTPServerManager : any
    workspace?  : string
    pkg?        : any                 // { name, ext, path, module, layer, group }
    fallbackModel? : PackageModel     // modelo vindo do índice (mostra na hora)
    wantReadme  : boolean
}

const usePackageDetails = ({ HTTPServerManager, workspace, pkg, fallbackModel, wantReadme }:Params) => {

    const [model, setModel]       = useState<PackageModel | undefined>(fallbackModel)
    const [loading, setLoading]   = useState(false)
    const [error, setError]       = useState<string | undefined>()
    const [readme, setReadme]     = useState<string | undefined>()
    const [readmeLoading, setReadmeLoading] = useState(false)
    const [retry, setRetry]       = useState(0)
    const token = useRef(0)

    const api = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "FileSystemNavigator")
    const key = pkg ? `${workspace}:${pkg.path}` : ""

    useEffect(() => {
        token.current += 1
        const mine = token.current
        setError(undefined)
        setReadme(undefined)
        // O modelo do índice entra imediatamente: sem tela vazia, sem conteúdo velho.
        setModel(fallbackModel)
        if(!pkg || !workspace){ setLoading(false); return }

        setLoading(true)
        api().GetPackageMetadata({ workspace, packageName: pkg.name, ext: pkg.ext })
            .then(({ data }:any) => {
                if(mine !== token.current) return
                setModel(buildPackageModel({ pkg, metadata: data || {}, repository: workspace }))
                setLoading(false)
            })
            .catch((e:any) => {
                if(mine !== token.current) return
                setLoading(false)
                if(!fallbackModel) setError((e && e.message) || String(e))
            })
    }, [key, retry])

    // README é lazy: só busca quando a aba correspondente é pedida.
    useEffect(() => {
        if(!wantReadme || !pkg || !workspace || readme !== undefined) return
        const mine = token.current
        setReadmeLoading(true)
        api().GetContentItem({ workspace, packageName: pkg.name, ext: pkg.ext, path: "/README.md" })
            .then(({ data }:any) => {
                if(mine !== token.current) return
                setReadme(typeof data === "string" && data.trim() ? data : "")
                setReadmeLoading(false)
            })
            .catch(() => {
                if(mine !== token.current) return
                setReadme("")
                setReadmeLoading(false)
            })
    }, [key, wantReadme])

    return {
        model,
        loading,
        error,
        readme: readme || undefined,
        readmeLoading,
        retry: () => setRetry((r) => r + 1)
    }
}

export default usePackageDetails
