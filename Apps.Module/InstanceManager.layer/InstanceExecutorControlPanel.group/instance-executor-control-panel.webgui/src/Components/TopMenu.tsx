import * as React from "react"
import { useState } from "react"
import {
    Menu,
    MenuMenu,
    MenuItem,
    Dropdown,
    DropdownMenu,
    DropdownItem,
    DropdownHeader,
    Icon
} from "semantic-ui-react"

import { THEMES, ApplyTheme, GetSavedTheme, ThemeName } from "../Utils/theme"

// Navegação principal do painel, na barra superior. O painel tem só duas telas
// (monitorar o que roda e lançar o que executar), então uma sidebar dedicada
// desperdiçava largura — os dois destinos vivem aqui, ao lado da marca.
export const MENU_ITEMS = [
    { name: "monitor",  label: "Task Executor Monitor", icon: "microchip" },
    { name: "launcher", label: "Launcher",              icon: "rocket" }
]

export const DEFAULT_MENU_ITEM = "monitor"

const TopMenu = ({ activeItem, onSelectMenu }:any) => {

    const [ theme, setTheme ] = useState<ThemeName>(GetSavedTheme())
    const selectTheme = (t:ThemeName) => { setTheme(t); ApplyTheme(t) }

    return <Menu
        className="eco-main-menu"
        borderless
        style={{ borderRadius: 0, margin: 0, minHeight: "var(--mp-shell-topbar-h)" }}>

        <MenuItem header style={{ cursor: "default" }}>
            <Icon name="rocket" size="large"/>
            <span className="eco-main-menu-title">Instance Executor Panel</span>
        </MenuItem>

        {
            MENU_ITEMS.map(({ name, label, icon }) =>
                <MenuItem
                    key={name}
                    name={name}
                    active={activeItem === name}
                    onClick={() => onSelectMenu(name)}>
                    <Icon name={icon as any}/> {label}
                </MenuItem>)
        }

        <MenuMenu position="right">
            <Dropdown item icon="sliders horizontal" simple>
                <DropdownMenu>
                    <DropdownHeader icon="paint brush" content="Theme"/>
                    {
                        THEMES.map((t) =>
                            <DropdownItem key={t.key} onClick={() => selectTheme(t.key)} active={theme === t.key}>
                                <Icon name={t.icon as any}/> {t.label}
                                { theme === t.key && <Icon name="check" style={{ float: "right", margin: 0 }}/> }
                            </DropdownItem>)
                    }
                </DropdownMenu>
            </Dropdown>
        </MenuMenu>
    </Menu>
}

export default TopMenu
