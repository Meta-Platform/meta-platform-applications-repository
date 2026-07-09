import * as React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import useApi from "./useApi"

// Quem sabe abrir o modal de um item. Cada tela que hospeda um inspector fornece
// este contexto; o WorkItemInspector fornece o seu (navegação por drill-down),
// de modo que uma referência clicada DENTRO do modal navega no próprio modal.
interface ItemNavigatorValue {
    openItem: (ref: string) => void          // ref = id ou key (GetItem resolve os dois)
    isKnownKey: (key: string) => boolean     // "CFGEC-26" existe? (valida o prefixo)
}

const ItemNavigatorContext = createContext<ItemNavigatorValue | null>(null)

// Prefixos de key dos projetos (CFGEC, MPMB…). Buscados uma vez por sessão de
// página e compartilhados por todos os providers aninhados.
let prefixCache: string[] | null = null

const useKeyPrefixes = (): string[] => {
    const api = useApi()
    const [prefixes, setPrefixes] = useState<string[]>(prefixCache || [])

    useEffect(() => {
        if (prefixCache) return
        let alive = true
        api.projects.list({})
            .then((list) => {
                const found = (list || [])
                    .map((p) => (p.keyPrefix || "").toUpperCase())
                    .filter(Boolean)
                prefixCache = found
                if (alive) setPrefixes(found)
            })
            .catch(() => { prefixCache = [] })
        return () => { alive = false }
    }, [api])

    return prefixes
}

interface ProviderProps {
    onOpenItem: (ref: string) => void
    children: React.ReactNode
}

export const ItemNavigatorProvider = ({ onOpenItem, children }: ProviderProps) => {
    const parent = useContext(ItemNavigatorContext)
    // Um provider aninhado (o do inspector) herda os prefixos já resolvidos e só
    // troca o destino do clique — não refaz o fetch de projetos.
    const fetched = useKeyPrefixes()
    const prefixes = parent ? null : fetched

    const isKnownKey = useCallback((key: string) => {
        if (parent) return parent.isKnownKey(key)
        const prefix = key.split("-")[0].toUpperCase()
        return (prefixes || []).indexOf(prefix) >= 0
    }, [parent, prefixes])

    const value = useMemo(() => ({ openItem: onOpenItem, isKnownKey }), [onOpenItem, isKnownKey])

    return <ItemNavigatorContext.Provider value={value}>{children}</ItemNavigatorContext.Provider>
}

// null quando não há inspector para abrir (ex.: um modal de aprovação solto):
// nesse caso as referências ficam como texto puro.
export const useItemNavigator = (): ItemNavigatorValue | null => useContext(ItemNavigatorContext)

export default useItemNavigator
