import * as React from "react"
import { useState } from "react"
import { Icon, IconButton, Popover } from "@i-components"

import listIcons    from "../Mocks/AppsMenu.mock"
import { THEMES, ApplyTheme, GetSavedTheme, ThemeName } from "@i-components/theme"


const MainMenu = ({ onHome, centerTitle }:any) => {

    const [ theme, setTheme ] = useState<ThemeName>(GetSavedTheme())
    const [ themeOpen, setThemeOpen ] = useState<boolean>(false)
    const selectTheme = (t:ThemeName) => { setTheme(t); ApplyTheme(t) }

    return <div className="pdx-appbar">
                <button type="button"
                    className="pdx-appbar__item is-active"
                    onClick={() => onHome && onHome()}
                    title="Ir para a home">
                    <Icon name="cube" color="teal" />
                    <span className="pdx-appbar__title">Package Developer</span>
                </button>
                {
                    centerTitle &&
                    <div className="pdx-appbar__center">
                        <span className="pdx-appbar__center-badge">
                            <Icon name="box" />{centerTitle}
                        </span>
                    </div>
                }
                <button type="button"
                    className="pdx-appbar__item"
                    onClick={() => onHome && onHome()}
                    title="Home (tela inicial)">
                    <Icon name="home" />
                </button>
                {
                    listIcons
                    .filter(({enable}:any) => enable)
                    .map(({icon, title, url}, key) =>
                        <button key={key}
                            type="button"
                            className="pdx-appbar__item"
                            title={title}
                            onClick={()=>{
                                //@ts-ignore
                                window.location = url
                            }}>
                            <img className="pdx-appbar__img" src={icon} alt={title}/>
                        </button>)
                }
                <span className="pdx-appbar__spacer"/>
                <Popover
                    className="pdx-appbar__popover"
                    open={themeOpen}
                    align="right"
                    onClose={() => setThemeOpen(false)}
                    trigger={
                        <IconButton
                            icon="paint brush"
                            label="Theme"
                            onClick={() => setThemeOpen(!themeOpen)}/>
                    }>
                    <div className="pdx-theme-menu">
                        <div className="pdx-theme-menu__head">
                            <Icon name="paint brush"/> Theme
                        </div>
                        {
                            THEMES.map((t) =>
                                <button key={t.key}
                                    type="button"
                                    className={`pdx-theme-menu__item ${theme === t.key ? "is-active" : ""}`.trim()}
                                    onClick={() => { selectTheme(t.key); setThemeOpen(false) }}>
                                    <Icon name={t.icon as any}/>
                                    <span className="pdx-theme-menu__label">{t.label}</span>
                                    { theme === t.key && <Icon name="check"/> }
                                </button>)
                        }
                    </div>
                </Popover>
            </div>
}


export default MainMenu
