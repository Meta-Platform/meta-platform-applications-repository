import * as React from "react"

import listIcons    from "../Mocks/AppsMenu.mock"


const MainMenu = () => {

    return <div className="pdx-appbar">
                <div className="pdx-appbar__item is-active is-static">
                    <span className="pdx-appbar__title">Package Developer</span>
                </div>
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
            </div>
}


export default MainMenu
