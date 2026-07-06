import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { IconPosition } from "../Utils/IconLayout"

// Ícone de aplicação na área de trabalho, posicionado em coordenadas absolutas
// (arrastável). A seleção e o arrasto são coordenados pelo container via
// onPointerDown; duplo-clique (ou Enter) abre a aplicação.
type DesktopIconProps = {
    label: string
    title?: string
    iconUrl?: string
    selected: boolean
    running?: boolean
    position: IconPosition
    dragging?: boolean
    onPointerDown: (e: React.PointerEvent) => void
    onOpen: () => void
    onContextMenu?: (e: React.MouseEvent) => void
}

const DesktopIcon = ({
    label, title, iconUrl, selected, running, position, dragging,
    onPointerDown, onOpen, onContextMenu
}:DesktopIconProps) => {

    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed

    return <button
        type="button"
        className={`myd-icon ${selected ? "myd-icon--selected" : ""} ${dragging ? "myd-icon--dragging" : ""}`}
        style={{ left: position.x, top: position.y }}
        title={title || label}
        onPointerDown={onPointerDown}
        onDoubleClick={(e) => { e.stopPropagation(); onOpen() }}
        onContextMenu={(e) => { e.stopPropagation(); onContextMenu && onContextMenu(e) }}
        onKeyDown={(e) => { if(e.key === "Enter") onOpen() }}>

        <span className="myd-icon__frame">
            { running && <span className="myd-icon__running" title="Em execução"/> }
            {
                showImage
                    ? <img className="myd-icon__img" src={iconUrl} alt={label} onError={() => setImageFailed(true)}/>
                    : <Icon name="desktop" className="myd-icon__glyph"/>
            }
        </span>
        <span className="myd-icon__label">{label}</span>
    </button>
}

export default DesktopIcon
