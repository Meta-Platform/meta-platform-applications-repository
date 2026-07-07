import * as React from "react"
import { useState } from "react"
import {
	Menu,
	Header,
	Image,
	Dropdown,
	Icon
} from "semantic-ui-react"
import styled from "styled-components"

import listIcons    from "../Mocks/AppsMenu.mock"
import { THEMES, ApplyTheme, GetSavedTheme, ThemeName } from "../Utils/theme"

const AppsMenuItem = styled(Menu.Item)`
	padding: 8px!important;
`

const MainMenu = ({ onHome, centerTitle }:any) => {

    const [ theme, setTheme ] = useState<ThemeName>(GetSavedTheme())
    const selectTheme = (t:ThemeName) => { setTheme(t); ApplyTheme(t) }

    return <Menu attached="top" className="eco-main-menu" style={{position:"relative"}}>
                <AppsMenuItem active onClick={() => onHome && onHome()}
                    style={{cursor:"pointer"}} title="Ir para a home">
                    <Icon name="cube" color="teal" />
                    <Header className="eco-main-menu-title" style={{margin:0}}>Package Developer</Header>
                </AppsMenuItem>
                {
                    centerTitle &&
                    <div style={{position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", pointerEvents:"none", whiteSpace:"nowrap"}}>
                        <span style={{
                            fontWeight:700, padding:"5px 16px", borderRadius:8, fontSize:"0.95em",
                            background:"var(--mp-accent-soft, rgba(20,214,200,0.16))",
                            border:"1px solid var(--mp-accent, #14D6C8)",
                            color:"var(--mp-text-primary, inherit)"
                        }}>
                            <Icon name="box" style={{marginRight:6}} />{centerTitle}
                        </span>
                    </div>
                }
                <AppsMenuItem onClick={() => onHome && onHome()} title="Home (tela inicial)">
                    <Icon name="home" style={{margin:0}} />
                </AppsMenuItem>
                {
                    listIcons
                    .filter(({enable}:any) => enable)
                    .map(({icon, title, url}, key) =>
                        <AppsMenuItem key={key}
                            title={title}
                            onClick={()=>{
                                //@ts-ignore
                                window.location = url
                            }}>
                            <Image spaced="right" src={icon} size="mini"/>
                        </AppsMenuItem>)
                }
                <Menu.Menu position="right">
                    <Dropdown item icon="paint brush" simple title="Theme">
                        <Dropdown.Menu>
                            <Dropdown.Header icon="paint brush" content="Theme"/>
                            {
                                THEMES.map((t) =>
                                    <Dropdown.Item key={t.key} onClick={() => selectTheme(t.key)} active={theme === t.key}>
                                        <Icon name={t.icon as any}/> {t.label}
                                        { theme === t.key && <Icon name="check" style={{ float: "right", margin: 0 }}/> }
                                    </Dropdown.Item>)
                            }
                        </Dropdown.Menu>
                    </Dropdown>
                </Menu.Menu>
            </Menu>
}


export default MainMenu
