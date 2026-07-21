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

export const GetSavedTheme = ():ThemeName => {
    try {
        const t = window.localStorage.getItem(STORAGE_KEY) as ThemeName
        return (t && THEMES.some((x) => x.key === t)) ? t : "light"
    } catch(_) { return "light" }
}

export const ApplyTheme = (theme:ThemeName) => {
    const root = document.documentElement
    if(theme === "light") root.removeAttribute("data-theme")
    else root.setAttribute("data-theme", theme)
    try { window.localStorage.setItem(STORAGE_KEY, theme) } catch(_) {}
}

// aplicado no boot, antes do render (evita "flash" do tema base).
// Suporta override por URL (?mp-theme=dark) — útil para compartilhar/testar.
export const applySavedTheme = () => {
    let theme = GetSavedTheme()
    try {
        const q = new URLSearchParams(window.location.search).get("mp-theme") as ThemeName
        if(q && THEMES.some((x) => x.key === q)) { theme = q; ApplyTheme(q) }
    } catch(_) {}
    if(theme !== "light") document.documentElement.setAttribute("data-theme", theme)
}
