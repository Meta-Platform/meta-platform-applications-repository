import * as React from "react"
import { Icon, ThemePicker } from "@i-components"

import listIcons    from "../Mocks/AppsMenu.mock"


const MainMenu = ({ onHome, centerTitle }:any) => {

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
                <ThemePicker className="pdx-appbar__popover" variant="popover" heading="Theme" label="Theme"/>
            </div>
}


export default MainMenu
