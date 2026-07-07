import { useEffect, useRef } from "react"

import useApi from "./useApi"
import { PlatformEvent } from "../api/types"

// Realtime por polling do EventsController.GetEvents(cursor). A cada `intervalMs`
// busca eventos novos desde o último cursor e dispara `onEvents`. Mantém o
// cursor num ref para não recriar o timer a cada evento.
export const useEvents = (
    onEvents: (events: PlatformEvent[]) => void,
    intervalMs: number = 3000
) => {
    const api = useApi()
    const cursorRef = useRef<number>(0)
    const onEventsRef = useRef(onEvents)
    onEventsRef.current = onEvents

    useEffect(() => {
        let stopped = false

        const tick = async () => {
            try {
                const res = await api.events.get(cursorRef.current, 200)
                if (stopped || !res) return
                cursorRef.current = res.cursor
                if (res.events && res.events.length > 0) onEventsRef.current(res.events)
            } catch (_) {
                // silencioso: polling é best-effort
            }
        }

        // primeira chamada só sincroniza o cursor (não replaya o buffer inteiro)
        const bootstrap = async () => {
            try {
                const res = await api.events.get(undefined, 1)
                if (!stopped && res) cursorRef.current = res.cursor
            } catch (_) {}
        }

        bootstrap()
        const timer = setInterval(tick, intervalMs)
        return () => { stopped = true; clearInterval(timer) }
    }, [api, intervalMs])
}

export default useEvents
