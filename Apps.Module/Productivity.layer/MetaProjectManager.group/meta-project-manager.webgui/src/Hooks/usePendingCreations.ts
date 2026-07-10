import { useCallback, useEffect, useState } from "react"

import useApi from "./useApi"
import useEvents from "./useEvents"
import { CreationRequest, PlatformEvent } from "../api/types"

// Carrega os pedidos de criação PENDENTES (projeto/board bloqueados de agentes)
// e mantém a lista fresca por polling do EventsController: quando chega um
// evento agent.session.pending (novo pedido), recarrega.
export const usePendingCreations = () => {
    const api = useApi()
    const [requests, setRequests] = useState<CreationRequest[]>([])
    const [loading, setLoading] = useState(true)

    const reload = useCallback(() => {
        return api.agents.listCreationRequests({ status: "pending" })
            .then((l) => setRequests(l || []))
            .catch(() => setRequests([]))
            .then(() => setLoading(false))
    }, [api])

    useEffect(() => { reload() }, [reload])

    // Qualquer mudança pode ter criado (ou decidido) um pedido: o pedido nasce de
    // um agente em OUTRO processo, e o que chega aqui é `audit.created`.
    const onEvents = useCallback((_events: PlatformEvent[]) => { reload() }, [reload])
    useEvents(onEvents)

    // Rede de segurança: a aprovação prende um agente do outro lado, então ela não
    // pode depender só do fluxo de eventos. Um heartbeat garante que o pedido
    // apareça mesmo se um tick de polling se perder.
    useEffect(() => {
        const timer = setInterval(reload, 5000)
        return () => clearInterval(timer)
    }, [reload])

    return { requests, count: requests.length, loading, reload }
}

export default usePendingCreations
