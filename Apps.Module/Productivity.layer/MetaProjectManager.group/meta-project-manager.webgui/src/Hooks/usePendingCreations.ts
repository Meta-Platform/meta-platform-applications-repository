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

    const onEvents = useCallback((events: PlatformEvent[]) => {
        const relevant = events.some((e) =>
            typeof e.type === "string" &&
            (e.type === "agent.session.pending" ||
             e.type.indexOf("creation") >= 0 ||
             e.type.indexOf("pending") >= 0))
        if (relevant) reload()
    }, [reload])

    useEvents(onEvents, 3000)

    return { requests, count: requests.length, loading, reload }
}

export default usePendingCreations
