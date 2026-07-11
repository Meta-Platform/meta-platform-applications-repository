import * as React from "react"
import { useState, useEffect } from "react"
import { Icon } from "semantic-ui-react"

import { THEMES, ThemeName, ApplyTheme, GetSavedTheme } from "../Utils/theme"
import useApi from "../Hooks/useApi"

// Chave da preferência de tema no app_state do servidor (mesma tabela que guarda
// último projeto, filtros, larguras). O tema também vai para o localStorage
// (aplicado no boot em index.tsx, sem flash); o servidor é a fonte DURÁVEL da
// "última escolha" — sobrevive a localStorage limpo, troca de máquina e Electron.
const THEME_STATE_KEY = "mp-theme"

// Seletor de tema (tokens --mp-* via data-theme). O app abre em dark por
// padrão (ver index.tsx), mas o usuário pode alternar entre as variantes.
const ThemeMenu = () => {
    const api = useApi()
    const [open, setOpen] = useState(false)
    const [theme, setTheme] = useState<ThemeName>(GetSavedTheme())

    // Ao montar, reconcilia com o tema salvo NO SERVIDOR. Se o servidor tiver uma
    // escolha diferente da do localStorage (ex.: localStorage foi limpo, ou outra
    // máquina), aplica a do servidor — é a "última escolha" real do usuário.
    useEffect(() => {
        let live = true
        api.system.getAppState(THEME_STATE_KEY).then((entry) => {
            const saved = (entry && entry.value) as ThemeName
            if (live && saved && THEMES.some((x) => x.key === saved) && saved !== GetSavedTheme()) {
                ApplyTheme(saved); setTheme(saved)
            }
        }).catch(() => { /* sem servidor/estado: mantém o tema do localStorage */ })
        return () => { live = false }
    }, [api])

    const pick = (t: ThemeName) => {
        ApplyTheme(t); setTheme(t); setOpen(false)
        // Persiste também no servidor (best-effort); o localStorage já foi salvo.
        try { api.system.setAppState(THEME_STATE_KEY, t).catch(() => {}) } catch (_) {}
    }

    return <div style={{ position: "relative" }}>
        <span className="mpm-iconbtn" data-tip="Trocar o tema (claro/escuro)" onClick={() => setOpen((o) => !o)}>
            <Icon name="paint brush" />
        </span>
        {open
            ? <div className="mpm-card" style={{
                position: "absolute", right: 0, top: "36px", zIndex: 1000,
                padding: "8px", minWidth: "180px"
            }}>
                {THEMES.map((t) =>
                    <div key={t.key}
                        className={`mpm-nav__item ${theme === t.key ? "is-active" : ""}`}
                        onClick={() => pick(t.key)}>
                        <Icon name={t.icon as any} /> {t.label}
                    </div>)}
            </div>
            : null}
    </div>
}

export default ThemeMenu
