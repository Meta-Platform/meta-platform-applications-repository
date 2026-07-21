import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { THEMES, ApplyTheme, GetSavedTheme, ThemeName } from "../Utils/theme"

// Barra de sistema (topbar) do Datasource Manager — mesmo padrão eco-main-menu
// dos demais apps. Marca à esquerda + seletor de tema à direita.
const Topbar = () => {

    const [theme, setTheme] = useState<ThemeName>(GetSavedTheme())

    const handleTheme = (event:React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value as ThemeName
        setTheme(value)
        ApplyTheme(value)
    }

    return <div className="ds-topbar">
                <div className="ds-topbar__brand">
                    <span className="ds-logo"><Icon name="database" fitted/></span>
                    Datasource Manager
                </div>
                <div className="ds-topbar__spacer"/>
                <Icon name="paint brush" style={{opacity:.6}}/>
                <select className="ds-input" value={theme} onChange={handleTheme} title="Tema">
                    {THEMES.map(({key, label}) => <option key={key} value={key}>{label}</option>)}
                </select>
            </div>
}

export default Topbar
