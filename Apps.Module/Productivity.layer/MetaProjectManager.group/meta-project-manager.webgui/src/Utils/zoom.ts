// Zoom da interface (Ctrl + "+" / "-" / "0"), como num editor.
//
// Os tokens de tipografia são px fixos (--mp-text-md: 14px), então mudar o
// font-size da raiz não escalaria nada. `zoom` no elemento raiz escala a página
// inteira — incluindo elementos `position: fixed` (modais, toasts, popover),
// que um `transform: scale()` quebraria.
const KEY = "mp-zoom"

const MIN = 0.6
const MAX = 2.0
const STEP = 0.1

export const DEFAULT_ZOOM = 1

const clamp = (value: number) => Math.min(MAX, Math.max(MIN, Math.round(value * 100) / 100))

export const GetSavedZoom = (): number => {
    try {
        const raw = window.localStorage.getItem(KEY)
        const value = raw ? Number(raw) : DEFAULT_ZOOM
        return Number.isFinite(value) && value > 0 ? clamp(value) : DEFAULT_ZOOM
    } catch (_) { return DEFAULT_ZOOM }
}

export const ApplyZoom = (zoom: number) => {
    const value = clamp(zoom)
    // `zoom` não está no tipo CSSStyleDeclaration em todas as libs; é suportado
    // por Chromium (e portanto pelo Electron e pelo navegador do app).
    ;(document.documentElement.style as any).zoom = String(value)
    try { window.localStorage.setItem(KEY, String(value)) } catch (_) {}
    return value
}

export const applySavedZoom = () => ApplyZoom(GetSavedZoom())

export const ZoomIn = () => ApplyZoom(GetSavedZoom() + STEP)
export const ZoomOut = () => ApplyZoom(GetSavedZoom() - STEP)
export const ZoomReset = () => ApplyZoom(DEFAULT_ZOOM)

// Ctrl/Cmd + "+" | "=" | "-" | "0". O "=" existe porque "+" exige Shift na
// maioria dos teclados e o navegador entrega a tecla sem o Shift aplicado.
export const HandleZoomShortcut = (e: KeyboardEvent): number | null => {
    if (!(e.ctrlKey || e.metaKey)) return null
    if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") { e.preventDefault(); return ZoomIn() }
    if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") { e.preventDefault(); return ZoomOut() }
    if (e.key === "0" || e.code === "Numpad0") { e.preventDefault(); return ZoomReset() }
    return null
}
