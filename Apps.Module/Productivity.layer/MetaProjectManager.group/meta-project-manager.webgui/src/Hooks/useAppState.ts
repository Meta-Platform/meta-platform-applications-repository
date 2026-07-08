import { useCallback, useEffect, useRef, useState } from "react"

import useApi from "./useApi"

// Persistência de preferências da GUI no servidor (SystemController app-state).
// Restaura no mount (fallback = valor default) e salva no servidor a cada set.
export const useAppState = <T,>(key: string, fallback: T): [T, (v: T) => void, boolean] => {
    const api = useApi()
    const [value, setValue] = useState<T>(fallback)
    const [loaded, setLoaded] = useState(false)
    const keyRef = useRef(key)
    keyRef.current = key

    useEffect(() => {
        let alive = true
        setLoaded(false)
        api.system.getAppState(key)
            .then((entry) => {
                if (!alive) return
                if (entry && entry.value !== undefined && entry.value !== null) setValue(entry.value as T)
                setLoaded(true)
            })
            .catch(() => { if (alive) setLoaded(true) })
        return () => { alive = false }
    }, [key])

    const save = useCallback((v: T) => {
        setValue(v)
        api.system.setAppState(keyRef.current, v).catch(() => {})
    }, [api])

    return [value, save, loaded]
}

// Escrita "fire-and-forget" sem estado (ex.: registrar lastProject ao navegar).
export const useAppStateWriter = () => {
    const api = useApi()
    return useCallback((key: string, value: any) => {
        api.system.setAppState(key, value).catch(() => {})
    }, [api])
}

export default useAppState
