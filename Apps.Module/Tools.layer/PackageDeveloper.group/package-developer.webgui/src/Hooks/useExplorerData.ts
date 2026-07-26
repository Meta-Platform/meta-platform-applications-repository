import { useCallback, useEffect, useMemo, useState } from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"
import { IndexedPackage, buildRepositoryIndex } from "../Domain/packageIndex"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME

// Carga dos índices (todos os pacotes com suas capacidades) e dos metadados dos
// repositórios ABERTOS. O ativo carrega em primeiro plano; os demais entram em
// segundo plano, para que a busca possa cobrir o workspace inteiro sem que o
// usuário precise trocar de repositório. Cache em memória por repositório.

export type RepositoryData = {
    packages : IndexedPackage[]
    metadata : any
    loading  : boolean
    error?   : string
}

const EMPTY:RepositoryData = { packages: [], metadata: undefined, loading: false }

type Params = {
    HTTPServerManager : any
    repository?   : string     // repositório ativo
    repositories? : string[]   // todos os abertos (inclui o ativo)
}

const useExplorerData = ({ HTTPServerManager, repository, repositories }:Params) => {

    const [byRepository, setByRepository] = useState<{[k:string]:RepositoryData}>({})
    const [reloadToken, setReloadToken]   = useState(0)

    const api = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "ModuleDeveloper")

    const patch = (name:string, data:Partial<RepositoryData>) =>
        setByRepository((prev) => ({ ...prev, [name]: { ...(prev[name] || EMPTY), ...data } as RepositoryData }))

    const openList = (repositories && repositories.length ? repositories : (repository ? [repository] : []))
    const openKey = openList.join(",")

    // Ordem de carga: o repositório ativo primeiro, os outros em seguida.
    const ordered = useMemo(() => {
        if(!repository) return openList
        return [repository].concat(openList.filter((name) => name !== repository))
    }, [openKey, repository])

    useEffect(() => {
        if(!ordered.length) return
        let cancelled = false

        const load = (name:string) => {
            patch(name, { loading: true, error: undefined })
            return Promise.all([
                api().GetRepositoryIndex({ workspace: name }),
                api().GetRepositoryMetadata({ workspace: name })
            ])
            .then(([indexResponse, metadataResponse]:any) => {
                if(cancelled) return
                patch(name, {
                    packages: buildRepositoryIndex(indexResponse.data),
                    metadata: metadataResponse.data,
                    loading : false
                })
            })
            .catch((e:any) => {
                if(cancelled) return
                patch(name, { loading: false, error: (e && e.message) || String(e) })
            })
        }

        // Sequencial: o ativo primeiro, e os demais sem competir com ele pela rede.
        ordered.reduce(
            (chain:Promise<any>, name:string) => chain.then(() => cancelled ? undefined : load(name)),
            Promise.resolve())

        return () => { cancelled = true }
    }, [ordered.join(","), reloadToken])

    const reload = useCallback(() => setReloadToken((t) => t + 1), [])

    const current = (repository && byRepository[repository]) || EMPTY

    const indexes = useMemo(() =>
        Object.keys(byRepository).reduce((acc:any, name) => {
            acc[name] = byRepository[name].packages
            return acc
        }, {}), [byRepository])

    // Todos os pacotes dos repositórios abertos (escopo "workspace" da busca).
    const allPackages = useMemo(() =>
        openList.reduce((acc:IndexedPackage[], name) => acc.concat((byRepository[name] || EMPTY).packages), []),
        [byRepository, openKey])

    const pendingRepositories = openList.filter((name) => !byRepository[name] || byRepository[name].loading)

    return {
        packages : current.packages,
        metadata : current.metadata,
        loading  : current.loading,
        error    : current.error,
        allPackages,
        indexes,
        pendingRepositories,
        reload
    }
}

export default useExplorerData
