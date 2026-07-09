import * as React from "react"
import { createContext, useCallback, useContext, useEffect, useRef } from "react"

import useApi from "./useApi"
import { PlatformEvent } from "../api/types"

// Realtime por polling do EventsController. UM único timer para o app inteiro:
// o provider busca os eventos novos desde o cursor e entrega a todos os inscritos.
// Antes cada hook abria o seu próprio polling (e o seu próprio cursor), o que
// multiplicava requisições e fazia telas verem eventos diferentes.
type Listener = (events: PlatformEvent[]) => void

interface EventsBus {
    subscribe: (listener: Listener) => () => void
}

const EventsContext = createContext<EventsBus | null>(null)

interface ProviderProps {
    intervalMs?: number
    children: React.ReactNode
}

export const EventsProvider = ({ intervalMs = 1200, children }: ProviderProps) => {
    const api = useApi()
    const cursorRef = useRef<number>(0)
    const listenersRef = useRef<Set<Listener>>(new Set())

    const subscribe = useCallback((listener: Listener) => {
        listenersRef.current.add(listener)
        return () => { listenersRef.current.delete(listener) }
    }, [])

    useEffect(() => {
        let stopped = false

        const tick = async () => {
            try {
                const res = await api.events.get(cursorRef.current, 200)
                if (stopped || !res) return
                cursorRef.current = res.cursor
                if (res.events && res.events.length > 0)
                    listenersRef.current.forEach((listener) => {
                        // Um listener que explode não pode calar os outros.
                        try { listener(res.events) } catch (_) {}
                    })
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

    const bus = useRef<EventsBus>({ subscribe })
    return <EventsContext.Provider value={bus.current}>{children}</EventsContext.Provider>
}

// Inscreve um handler no fluxo de eventos. Sem provider (ex.: testes de unidade),
// vira no-op silencioso. O segundo parâmetro existe por compatibilidade com as
// chamadas antigas — o intervalo agora é do provider.
export const useEvents = (onEvents: Listener, _intervalMs?: number) => {
    const bus = useContext(EventsContext)
    const onEventsRef = useRef(onEvents)
    onEventsRef.current = onEvents

    useEffect(() => {
        if (!bus) return
        return bus.subscribe((events) => onEventsRef.current(events))
    }, [bus])
}

export default useEvents
