import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

// Item do dock (ícone pequeno com fallback de glifo + ponto de "em execução").
const DockItem = ({ label, iconUrl, running, onOpen }:{ label:string, iconUrl?:string, running?:boolean, onOpen:()=>void }) => {
    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed
    return <button type="button" className={`myd-dock__item ${running ? "myd-dock__item--running" : ""}`} title={label} onClick={onOpen}>
        {
            showImage
                ? <img className="myd-dock__img" src={iconUrl} alt={label} onError={() => setImageFailed(true)}/>
                : <Icon name="desktop" className="myd-dock__glyph"/>
        }
    </button>
}

// Dock inferior centralizado com os apps instalados. Clique lança a aplicação.
type DockProps = {
    apps: Array<{ key:string, label:string, iconUrl?:string, running?:boolean, onOpen:()=>void }>
}

const Dock = ({ apps }:DockProps) => {
    if(apps.length === 0) return null
    return <div className="myd-dock-wrap">
        <div className="myd-dock">
            {
                apps.map((app) =>
                    <DockItem key={app.key} label={app.label} iconUrl={app.iconUrl} running={app.running} onOpen={app.onOpen}/>)
            }
        </div>
    </div>
}

export default Dock
