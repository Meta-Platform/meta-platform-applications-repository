import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { THEMES, ThemeName, ApplyTheme, GetSavedTheme } from "../Utils/theme"

// Seletor de tema (tokens --mp-* via data-theme). O app abre em dark por
// padrão (ver index.tsx), mas o usuário pode alternar entre as variantes.
const ThemeMenu = () => {
    const [open, setOpen] = useState(false)
    const [theme, setTheme] = useState<ThemeName>(GetSavedTheme())

    const pick = (t: ThemeName) => { ApplyTheme(t); setTheme(t); setOpen(false) }

    return <div style={{ position: "relative" }}>
        <span className="mpm-iconbtn" title="Tema" onClick={() => setOpen((o) => !o)}>
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
