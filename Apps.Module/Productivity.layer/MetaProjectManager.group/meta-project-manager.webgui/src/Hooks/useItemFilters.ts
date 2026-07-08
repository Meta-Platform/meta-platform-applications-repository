import { useCallback, useEffect, useState } from "react"

import { ListItemsQuery } from "../api/items"

// Filtros ativos + agrupamento de uma visão de itens, persistidos por projeto
// em localStorage (tabela app_state não exposta via controllers listados).
export type GroupBy = "none" | "horizon" | "parent" | "area" | "sprint"

export interface WorkspaceFilterState {
    filters: ListItemsQuery
    group: GroupBy
}

const DEFAULT: WorkspaceFilterState = { filters: {}, group: "none" }

const keyFor = (scope: string, projectId?: string) => `mpm-filters:${scope}:${projectId || "_"}`

export const useItemFilters = (scope: string, projectId?: string) => {
    const [state, setState] = useState<WorkspaceFilterState>(DEFAULT)

    // carrega ao trocar de projeto/escopo
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(keyFor(scope, projectId))
            setState(raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT)
        } catch (_) { setState(DEFAULT) }
    }, [scope, projectId])

    const persist = useCallback((next: WorkspaceFilterState) => {
        setState(next)
        try { window.localStorage.setItem(keyFor(scope, projectId), JSON.stringify(next)) } catch (_) {}
    }, [scope, projectId])

    const setFilter = useCallback((name: keyof ListItemsQuery, value: string) => {
        setState((prev) => {
            const filters = { ...prev.filters }
            if (value) (filters as any)[name] = value
            else delete (filters as any)[name]
            const next = { ...prev, filters }
            try { window.localStorage.setItem(keyFor(scope, projectId), JSON.stringify(next)) } catch (_) {}
            return next
        })
    }, [scope, projectId])

    const setGroup = useCallback((group: GroupBy) => {
        setState((prev) => {
            const next = { ...prev, group }
            try { window.localStorage.setItem(keyFor(scope, projectId), JSON.stringify(next)) } catch (_) {}
            return next
        })
    }, [scope, projectId])

    const reset = useCallback(() => persist(DEFAULT), [persist])

    const activeCount = Object.keys(state.filters).filter((k) => k !== "sort" && (state.filters as any)[k]).length

    return { filters: state.filters, group: state.group, setFilter, setGroup, reset, activeCount }
}

export default useItemFilters
