import { useCallback, useRef } from "react"

import useEvents from "./useEvents"
import { touchesProject } from "../Utils/agentEvents"
import { PlatformEvent } from "../api/types"

interface Options {
    // Recarrega só quando o lote mexeu neste projeto.
    projectId?: string
    // Telas globais (projetos, usuários, agentes, auditoria) recarregam sempre.
    always?: boolean
}

// Mantém uma tela viva: quando alguém (agente ou outra pessoa) muda algo, ela
// se recarrega sozinha. `reload` pode ser recriado a cada render sem problema —
// guardamos a última referência.
export const useLiveReload = (reload: () => any, { projectId, always }: Options = {}) => {
    const reloadRef = useRef(reload)
    reloadRef.current = reload

    const onEvents = useCallback((events: PlatformEvent[]) => {
        if (always || touchesProject(events, projectId)) reloadRef.current()
    }, [always, projectId])

    useEvents(onEvents)
}

export default useLiveReload
