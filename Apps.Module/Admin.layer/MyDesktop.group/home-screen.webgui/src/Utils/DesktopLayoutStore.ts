// Cliente de persistência do LAYOUT da área de trabalho (atalhos + posições +
// dock), agora no BACKEND (controller DesktopLayout, dual-transport HTTP/IPC).
// Substitui o papel de persistência do antigo localStorage de posições; a
// geometria pura (grade, posição padrão) continua em IconLayout.ts.
//
// O documento tem a forma:
//   { initialized:boolean, desktop:[{key,x,y}], dock:[key] }
// `initialized === false` = arquivo ainda não existe → o container faz a
// migração inicial (semeia com os apps instalados) e salva.

export type DesktopEntry  = { key: string, x: number, y: number }
// `seen` = keys que o desktop já conheceu (distingue app recém-instalado de
// atalho removido de propósito).
export type DesktopLayout = { initialized: boolean, desktop: DesktopEntry[], dock: string[], seen: string[] }

// ---- carregar / salvar (via API) ---------------------------------------

// `api` é o objeto retornado por GetAPI({ apiName: "DesktopLayout", ... }).
export const LoadLayout = async (api: any): Promise<DesktopLayout> => {
    const response = await api.GetDesktopLayout()
    const data = (response && response.data) || {}
    return {
        initialized: Boolean(data.initialized),
        desktop: Array.isArray(data.desktop)
            ? data.desktop.filter((e: any) => e && typeof e.key === "string")
                .map((e: any) => ({ key: e.key, x: Number(e.x) || 0, y: Number(e.y) || 0 }))
            : [],
        dock: Array.isArray(data.dock) ? data.dock.filter((k: any) => typeof k === "string") : [],
        seen: Array.isArray(data.seen) ? data.seen.filter((k: any) => typeof k === "string") : []
    }
}

export const SaveLayoutNow = (api: any, layout: { desktop: DesktopEntry[], dock: string[], seen: string[] }) =>
    api.SaveDesktopLayout({ layout: { desktop: layout.desktop, dock: layout.dock, seen: layout.seen } })

// Salvamento debounced: o arrasto de reposicionamento emite muitos updates;
// só o último (após ~400ms de quietude) chega ao backend.
let _saveTimer: any = null
let _pending: { api: any, layout: { desktop: DesktopEntry[], dock: string[], seen: string[] } } | null = null

export const SaveLayoutDebounced = (
    api: any,
    layout: { desktop: DesktopEntry[], dock: string[], seen: string[] },
    delay = 400
) => {
    _pending = { api, layout }
    if(_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => {
        _saveTimer = null
        if(!_pending) return
        const { api: a, layout: l } = _pending
        _pending = null
        try { SaveLayoutNow(a, l) } catch(_) { /* backend pode estar indisponível */ }
    }, delay)
}

// ---- helpers puros sobre a dock (array de keys) -------------------------

export const addKey = (list: string[], key: string): string[] =>
    list.includes(key) ? list : [ ...list, key ]

export const removeKey = (list: string[], key: string): string[] =>
    list.filter((k) => k !== key)

// Move `key` para a posição `toIndex` (usado no reordenamento da dock).
export const moveKey = (list: string[], key: string, toIndex: number): string[] => {
    const without = list.filter((k) => k !== key)
    const clamped = Math.max(0, Math.min(toIndex, without.length))
    return [ ...without.slice(0, clamped), key, ...without.slice(clamped) ]
}
