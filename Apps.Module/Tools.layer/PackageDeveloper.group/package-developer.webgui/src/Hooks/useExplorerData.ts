import { useCallback, useEffect, useState } from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"
import { IndexedPackage, buildRepositoryIndex } from "../Domain/packageIndex"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Carga do índice do repositório (todos os pacotes com suas capacidades) e dos
// metadados do próprio repositório. Uma chamada por repositório, com cache em
// memória — a busca e os filtros trabalham sobre isso, sem ir ao servidor.

export type RepositoryData = {
    packages : IndexedPackage[]
    metadata : any
    loading  : boolean
    error?   : string
}

const EMPTY:RepositoryData = { packages: [], metadata: undefined, loading: false }

const useExplorerData = ({ HTTPServerManager, repository }:any) => {

    const [byRepository, setByRepository] = useState<{[k:string]:RepositoryData}>({})
    const [reloadToken, setReloadToken]   = useState(0)

    const api = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "ModuleDeveloper")

    const patch = (name:string, data:Partial<RepositoryData>) =>
        setByRepository((prev) => ({ ...prev, [name]: { ...(prev[name] || EMPTY), ...data } as RepositoryData }))

    useEffect(() => {
        if(!repository) return
        let cancelled = false
        patch(repository, { loading: true, error: undefined })

        Promise.all([
            api().GetRepositoryIndex({ workspace: repository }),
            api().GetRepositoryMetadata({ workspace: repository })
        ])
        .then(([indexResponse, metadataResponse]:any) => {
            if(cancelled) return
            patch(repository, {
                packages: buildRepositoryIndex(indexResponse.data),
                metadata: metadataResponse.data,
                loading : false
            })
        })
        .catch((e:any) => {
            if(cancelled) return
            patch(repository, { loading: false, error: (e && e.message) || String(e) })
        })

        return () => { cancelled = true }
    }, [repository, reloadToken])

    const reload = useCallback(() => setReloadToken((t) => t + 1), [])

    const current = (repository && byRepository[repository]) || EMPTY

    return {
        packages : current.packages,
        metadata : current.metadata,
        loading  : current.loading,
        error    : current.error,
        indexes  : Object.keys(byRepository).reduce((acc:any, name) => {
            acc[name] = byRepository[name].packages
            return acc
        }, {}),
        reload
    }
}

export default useExplorerData
