import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

// Ícone de aplicação na área de trabalho: quadro com ícone (imagem servida
// pelo backend ou glifo de fallback) + rótulo. Clique seleciona; duplo-clique
// (ou Enter) abre a aplicação.
type DesktopIconProps = {
    label: string
    title?: string
    iconUrl?: string
    selected: boolean
    onSelect: () => void
    onOpen: () => void
    onContextMenu?: (e: React.MouseEvent) => void
}

const DesktopIcon = ({ label, title, iconUrl, selected, onSelect, onOpen, onContextMenu }:DesktopIconProps) => {

    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed

    return <button
        type="button"
        className={`myd-icon ${selected ? "myd-icon--selected" : ""}`}
        title={title || label}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        onDoubleClick={(e) => { e.stopPropagation(); onOpen() }}
        onContextMenu={(e) => { e.stopPropagation(); onSelect(); onContextMenu && onContextMenu(e) }}
        onKeyDown={(e) => { if(e.key === "Enter") onOpen() }}>

        <span className="myd-icon__frame">
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
