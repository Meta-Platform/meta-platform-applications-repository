import * as React from "react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { useSelector } from "react-redux"

import { createApiClient } from "../api/client"
import { Project } from "../api/types"

// Estado global de "somente leitura": um projeto ARQUIVADO é imutável. Este
// provider observa a rota, descobre o projeto aberto e, se ele estiver
// arquivado, marca readOnly=true para TODA a árvore. É a fonte que:
//   - o AppShell usa para o selo "somente leitura" no topo;
//   - o useApi usa para bloquear escrita no cliente (defense-in-depth);
//   - cada afordância de edição usa para se esconder.
// O backend é a garantia final (project-store: PROJECT_ARCHIVED); aqui é UX.
interface ReadOnlyValue {
    readOnly: boolean
    // Projeto atual (quando numa rota de projeto), já resolvido — reaproveitado
    // pela coluna do projeto para mostrar o arquivado no seletor.
    project: Project | null
}

const ReadOnlyContext = createContext<ReadOnlyValue>({ readOnly: false, project: null })

// Extrai o id do projeto de uma rota tipo /projects/:id[/board|/list|...].
const projectIdFromPath = (pathname: string): string | undefined => {
    const m = pathname.match(/^\/projects\/([^/]+)/)
    return m ? m[1] : undefined
}

export const ReadOnlyProvider = ({ children }: { children: React.ReactNode }) => {
    const { pathname } = useLocation()
    const HTTPServerManager = useSelector((state: any) => state.HTTPServerManager)
    // Cliente NÃO guardado (readOnly=false) só para LER o status do projeto:
    // este fetch precisa rodar mesmo dentro do modo leitura.
    const api = useMemo(() => createApiClient(HTTPServerManager), [HTTPServerManager])

    const projectId = projectIdFromPath(pathname)
    const [project, setProject] = useState<Project | null>(null)

    useEffect(() => {
        if (!projectId) { setProject(null); return }
        let alive = true
        api.projects.get(projectId)
            .then((p) => { if (alive) setProject(p) })
            .catch(() => { if (alive) setProject(null) })
        return () => { alive = false }
    }, [projectId, api])

    // Só é read-only quando o projeto RESOLVIDO da rota atual está arquivado.
    const readOnly = !!(projectId && project && project.id === projectId && project.status === "archived")
    const value = useMemo<ReadOnlyValue>(() => ({ readOnly, project: readOnly ? project : null }), [readOnly, project])

    return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>
}

// Hook de conveniência: true quando a tela atual é um projeto arquivado.
export const useReadOnly = (): boolean => useContext(ReadOnlyContext).readOnly

// Acesso ao projeto arquivado atual (para o seletor de projeto).
export const useReadOnlyProject = (): Project | null => useContext(ReadOnlyContext).project

export default useReadOnly
