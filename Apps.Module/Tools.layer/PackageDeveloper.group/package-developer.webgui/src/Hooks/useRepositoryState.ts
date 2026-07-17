import { useEffect, useState } from "react"

import GetRequestByServer from "../Utils/GetRequestByServer"

const SERVER_APP_NAME = process.env.SERVER_APP_NAME
const OPEN_REPOS_KEY = "ide:open-repositories"
const LAST_REPOSITORY_KEY = "ide:last-repository"

// Estado central do modo Repository: recentes, repositórios ABERTOS (múltiplos),
// repositório ativo e hierarquias (cacheadas por repo).
const useRepositoryState = ({ HTTPServerManager }:any) => {

    const svc = () => GetRequestByServer(HTTPServerManager)(SERVER_APP_NAME, "ModuleDeveloper")

    const [recents, setRecents]                 = useState<any[]>([])
    const [openRepositories, setOpenRepositories] = useState<string[]>([])
    const [activeRepository, setActiveRepository] = useState<string | undefined>()
    const [hierarchies, setHierarchies]         = useState<{[k:string]:any}>({})
    // Status git (reativo): mapa caminho->status (nós da árvore) + resumo por repo
    // (painel de repositórios). Alimentado por um WS que empurra o estado a cada
    // mudança em disco — sem polling.
    const [gitStatus, setGitStatus]             = useState<{statusByPath:any, repositories:any}>({ statusByPath:{}, repositories:{} })

    const loadRecents = () =>
        svc().ListRecentRepositories().then(({data}:any) => setRecents(data || []))

    const persistOpen = (list:string[], active?:string) => {
        svc().SetAppState({ key: OPEN_REPOS_KEY, value: JSON.stringify(list) })
        svc().SetAppState({ key: LAST_REPOSITORY_KEY, value: active || "" })
    }

    const fetchHierarchy = (name:string) =>
        svc().GetRepositoryHierarchy({ workspace: name })
            .then(({data}:any) => setHierarchies((prev) => ({ ...prev, [name]: data })))
            .then(() => loadRecents())

    // Abre um repositório (adiciona à lista de abertos e torna ativo).
    const openRepository = (name:string) => {
        setActiveRepository(name)
        const nextOpen = openRepositories.includes(name) ? openRepositories : [...openRepositories, name]
        setOpenRepositories(nextOpen)
        persistOpen(nextOpen, name)
        return hierarchies[name] ? Promise.resolve() : fetchHierarchy(name)
    }

    // Alterna o repositório ativo (já aberto).
    const switchRepository = (name:string) => {
        setActiveRepository(name)
        svc().SetAppState({ key: LAST_REPOSITORY_KEY, value: name })
        if(!hierarchies[name]) fetchHierarchy(name)
    }

    // Fecha um repositório aberto (mantém no banco/recentes).
    const closeOpenRepository = (name:string) => {
        const next = openRepositories.filter((n) => n !== name)
        setOpenRepositories(next)
        setHierarchies((prev) => { const copy = { ...prev }; delete copy[name]; return copy })
        let newActive = activeRepository
        if(activeRepository === name){
            newActive = next.length ? next[next.length - 1] : undefined
            setActiveRepository(newActive)
        }
        persistOpen(next, newActive)
    }

    // Volta à tela de boas-vindas (mantém os repositórios abertos).
    const goToWelcome = () => setActiveRepository(undefined)

    const createRepository = ({ name, path }:{name:string, path:string}) =>
        svc().CreateWorkspace({ name, path }).then(() => loadRecents())

    // Cria um Repository do zero (scaffold) em <path>/<name>.
    const scaffoldRepository = ({ name, path }:{name:string, path:string}) =>
        svc().CreateRepository({ name, path }).then(() => loadRecents())

    // Re-carrega a hierarquia do repositório ativo (após criar estrutura).
    const reloadHierarchy = (name?:string) => {
        const target = name || activeRepository
        return target ? fetchHierarchy(target) : Promise.resolve()
    }

    // Cria Module/Layer/Group no repositório ativo.
    const createContainer = ({ parentPath, name, kind }:{parentPath:string, name:string, kind:string}) =>
        svc().CreateContainer({ workspace: activeRepository, parentPath, name, kind })
            .then(() => reloadHierarchy())

    // Cria um pacote no destino (Layer/Group) do repositório ativo.
    const createPackage = ({ targetPath, packageName, ext }:{targetPath:string, packageName:string, ext:string}) =>
        svc().CreatePackage({ workspace: activeRepository, targetPath, packageName, ext })
            .then(() => reloadHierarchy())

    // Renomeia um nó (container ou pacote) preservando o sufixo de tipo.
    const renameNode = ({ path, newName }:{path:string, newName:string}) =>
        svc().RenameNode({ workspace: activeRepository, path, newName })
            .then(() => reloadHierarchy())

    // Exclui um nó (container ou pacote) recursivamente.
    const removeNode = ({ path }:{path:string}) =>
        svc().DeleteNode({ workspace: activeRepository, path })
            .then(() => reloadHierarchy())

    const removeRepository = (name:string) =>
        svc().RemoveWorkspace({ name }).then(() => { closeOpenRepository(name); loadRecents() })

    // Memória de UI (larguras de coluna, etc.) via AppState do banco.
    const getAppState = (key:string) => svc().GetAppState({ key }).then(({data}:any) => data)
    const setAppState = (key:string, value:string) => svc().SetAppState({ key, value })

    // Assina o status git dos repositórios ABERTOS. Reabre o socket quando a
    // lista muda (ou quando o servidor fica disponível). O backend empurra o
    // estado completo no início e a cada mudança em disco.
    const serversReady = (HTTPServerManager && HTTPServerManager.list_web_servers_running || []).length
    useEffect(() => {
        if(!openRepositories.length){ setGitStatus({ statusByPath:{}, repositories:{} }); return }
        const api = svc()
        if(!api || !api.GitStatusStream) return
        let ws:any
        try { ws = api.GitStatusStream({ repositories: openRepositories.join(",") }) } catch(e) { return }
        ws.onmessage = (event:any) => {
            try { setGitStatus(JSON.parse(event.data)) } catch(e) {}
        }
        return () => { try { ws && ws.close() } catch(e) {} }
    }, [openRepositories.join(","), serversReady])

    // Carga inicial: recentes + restaura os repositórios abertos + o ativo.
    useEffect(() => {
        loadRecents()
        Promise.all([
            svc().GetAppState({ key: OPEN_REPOS_KEY }),
            svc().GetAppState({ key: LAST_REPOSITORY_KEY })
        ]).then(([openRes, lastRes]:any) => {
            let open:string[] = []
            try { open = typeof openRes.data === "string" ? JSON.parse(openRes.data) : (openRes.data || []) } catch(e) {}
            if(Array.isArray(open) && open.length){
                setOpenRepositories(open)
                open.forEach((n) => fetchHierarchy(n))
                const last = lastRes.data && open.indexOf(lastRes.data) > -1 ? lastRes.data : open[0]
                setActiveRepository(last)
            }
        }).catch(() => {})
    }, [])

    return {
        recents,
        openRepositories,
        activeRepository,
        hierarchy: activeRepository ? hierarchies[activeRepository] : undefined,
        gitStatusByPath: gitStatus.statusByPath || {},
        gitRepositories: gitStatus.repositories || {},
        openRepository,
        switchRepository,
        closeOpenRepository,
        goToWelcome,
        createRepository,
        scaffoldRepository,
        createContainer,
        createPackage,
        renameNode,
        removeNode,
        reloadHierarchy,
        removeRepository,
        getAppState,
        setAppState
    }
}

export default useRepositoryState
