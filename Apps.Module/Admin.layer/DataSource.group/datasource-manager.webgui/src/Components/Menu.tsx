import * as React from "react"
import { useState } from "react"

import {
    Topbar, Menu, Popover, IconButton,
    THEMES, ThemeName, GetSavedTheme, ApplyTheme
} from "@i-components"

type Props = { subtitle?:string }

// Barra de sistema do Datasource Manager. A identidade e o seletor de tema são
// os do kit (`Topbar` + `Popover`/`Menu`): a barra deixou de ser uma composição
// local de <div> e passou a ser a mesma dos demais aplicativos.
const AppTopbar = ({subtitle}:Props) => {

    const [theme, setTheme]         = useState<ThemeName>(GetSavedTheme())
    const [themeOpen, setThemeOpen] = useState(false)

    const handleTheme = (value:ThemeName) => {
        setTheme(value)
        ApplyTheme(value)
        setThemeOpen(false)
    }

    return <Topbar
        brand    = "Datasource Manager"
        subtitle = {subtitle}
        right    = {
            <Popover
                open    = {themeOpen}
                align   = "right"
                onClose = {() => setThemeOpen(false)}
                trigger = {<IconButton icon="paint brush" label="trocar tema" onClick={() => setThemeOpen(!themeOpen)}/>}>
                <Menu
                    onClose = {() => setThemeOpen(false)}
                    items   = {THEMES.map(({key, label, icon}) => ({
                        key,
                        icon,
                        label   : `${label}${key === theme ? " ✓" : ""}`,
                        onSelect: () => handleTheme(key)
                    }))}/>
            </Popover>
        }/>
}

export default AppTopbar
