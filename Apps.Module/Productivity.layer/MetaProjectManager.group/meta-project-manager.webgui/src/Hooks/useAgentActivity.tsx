import { useCallback, useEffect, useState } from "react"

import { PlatformEvent } from "../api/types"
import { auditEntriesOf } from "../Utils/agentEvents"
import useEvents from "./useEvents"

// "Coisa acontecendo": marca os itens que um AGENTE acabou de tocar, ao vivo.
//
// Toda mutação emite `audit.created` com o ator (agente/provider/modelo) e a
// entidade. Quando um agente age num item, marcamos esse item como EM EXECUÇÃO
// por uma janela curta; cada nova ação renova a janela. Assim o card pulsa
// enquanto o agente trabalha e volta ao normal quando ele para — sem precisar de
// um "estado de execução" persistido no domínio.
const WINDOW_MS = 18000

interface Live { until: number; actor: string }

// Retorna { [itemId]: rótuloDoAgente } só dos itens ativos AGORA (já podados).
export const useAgentActivity = (projectId?: string): { [itemId: string]: string } => {
    const [active, setActive] = useState<{ [id: string]: Live }>({})

    const onEvents = useCallback((events: PlatformEvent[]) => {
        const agentEntries = auditEntriesOf(events).filter((e) => e.actorType === "agent")
        if (agentEntries.length === 0) return
        const now = Date.now()
        setActive((prev) => {
            const next = { ...prev }
            let changed = false
            agentEntries.forEach((e) => {
                if (projectId && e.projectId !== projectId) return
                // Ação direta no item, ou num filho do item (comentário/anexo).
                const itemId = e.entityType === "work-item"
                    ? e.entityId
                    : (e.metadata && (e.metadata as any).workItemId) || undefined
                if (!itemId) return
                next[itemId] = { until: now + WINDOW_MS, actor: (e as any).provider || (e as any).model || "agente" }
                changed = true
            })
            return changed ? next : prev
        })
    }, [projectId])

    useEvents(onEvents)

    // Poda periódica: um item deixa de "executar" quando a janela expira.
    useEffect(() => {
        const timer = setInterval(() => {
            setActive((prev) => {
                const now = Date.now()
                let changed = false
                const next: { [id: string]: Live } = {}
                for (const k in prev) { if (prev[k].until > now) next[k] = prev[k]; else changed = true }
                return changed ? next : prev
            })
        }, 2000)
        return () => clearInterval(timer)
    }, [])

    const now = Date.now()
    const out: { [id: string]: string } = {}
    for (const k in active) if (active[k].until > now) out[k] = active[k].actor
    return out
}

export default useAgentActivity
