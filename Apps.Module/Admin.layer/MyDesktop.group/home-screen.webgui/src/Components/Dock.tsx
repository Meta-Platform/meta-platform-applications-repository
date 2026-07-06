import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

// Item do dock: ícone pequeno com fallback de glifo, rótulo em balão ao passar
// o mouse, destaque de "em execução" e menu de contexto (botão direito).
type DockItemProps = {
    label: string
    iconUrl?: string
    running?: boolean
    onOpen: () => void
    onContextMenu?: (e:React.MouseEvent) => void
}

const DockItem = ({ label, iconUrl, running, onOpen, onContextMenu }:DockItemProps) => {
    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed
    return <button
        type="button"
        className={`myd-dock__item ${running ? "myd-dock__item--running" : ""}`}
        aria-label={running ? `${label} (em execução)` : label}
        onClick={onOpen}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e) }}>
        <span className="myd-dock__label">{label}{ running && <span className="myd-dock__label-run">• em execução</span> }</span>
        {
            showImage
                ? <img className="myd-dock__img" src={iconUrl} alt={label} onError={() => setImageFailed(true)}/>
                : <Icon name="desktop" className="myd-dock__glyph"/>
        }
    </button>
}

// Dock inferior centralizado com os apps instalados. Clique lança a aplicação;
// botão direito abre o menu de contexto (abrir / encerrar / remover).
type DockProps = {
    apps: Array<{ key:string, label:string, iconUrl?:string, running?:boolean, onOpen:()=>void, onContextMenu?:(e:React.MouseEvent)=>void }>
}

const Dock = ({ apps }:DockProps) => {
    if(apps.length === 0) return null
    return <div className="myd-dock-wrap">
        <div className="myd-dock">
            {
                apps.map((app) =>
                    <DockItem key={app.key} label={app.label} iconUrl={app.iconUrl}
                        running={app.running} onOpen={app.onOpen} onContextMenu={app.onContextMenu}/>)
            }
        </div>
    </div>
}

export default Dock
