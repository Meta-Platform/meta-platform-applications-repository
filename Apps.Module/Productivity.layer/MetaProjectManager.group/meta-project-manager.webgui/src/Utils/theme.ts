// Seleção de tema visual do painel. Cada tema é um conjunto de tokens --mp-*
// aplicado via atributo data-theme no <html> (ver Styles/themes.css).
// "light" (base off-white) = sem atributo.

export type ThemeName = "light" | "dark" | "gray" | "blue" | "cyberpunk"

export const THEMES: { key: ThemeName, label: string, icon: string }[] = [
    { key: "light",     label: "Retro (light)", icon: "sun" },
    { key: "dark",      label: "Dark",          icon: "moon" },
    { key: "gray",      label: "Grayscale",     icon: "adjust" },
    { key: "blue",      label: "Blue",          icon: "tint" },
    { key: "cyberpunk", label: "Cyberpunk",     icon: "bolt" }
]

const STORAGE_KEY = "mp-theme"
// Marca que o tema salvo foi ESCOLHIDO por alguém, e não semeado pelo app. Sem
// isso, trocar o padrão não teria efeito em quem já abriu o app uma vez: o valor
// semeado ficaria gravado para sempre.
const EXPLICIT_KEY = "mp-theme-explicit"

// Default do app = grayscale.
export const DEFAULT_THEME:ThemeName = "gray"

const _isThemeName = (value:string | null):value is ThemeName =>
    !!value && THEMES.some((x) => x.key === value)

// O usuário escolheu um tema alguma vez?
export const HasExplicitTheme = ():boolean => {
    try { return window.localStorage.getItem(EXPLICIT_KEY) === "1" } catch(_) { return false }
}

export const GetSavedTheme = ():ThemeName => {
    try {
        if(!HasExplicitTheme()) return DEFAULT_THEME
        const t = window.localStorage.getItem(STORAGE_KEY)
        return _isThemeName(t) ? t : DEFAULT_THEME
    } catch(_) { return DEFAULT_THEME }
}

// `explicit` só é falso no boot, quando o app apenas aplica o default.
export const ApplyTheme = (theme:ThemeName, explicit = true) => {
    const root = document.documentElement
    if(theme === "light") root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", theme)
    try {
        window.localStorage.setItem(STORAGE_KEY, theme)
        if(explicit) window.localStorage.setItem(EXPLICIT_KEY, "1")
    } catch(_) {}
}

// aplicado no boot, antes do render (evita "flash" do tema base).
// Suporta override por URL (?mp-theme=dark) — útil para compartilhar/testar.
export const applySavedTheme = () => {
    let theme = GetSavedTheme()
    try {
        const q = new URLSearchParams(window.location.search).get("mp-theme")
        // O override por URL não é uma escolha permanente do usuário.
        if(_isThemeName(q)) { theme = q; ApplyTheme(q, false) }
    } catch(_) {}
    if(theme !== "light") document.documentElement.setAttribute("data-theme", theme)
    else document.documentElement.removeAttribute("data-theme")
}
