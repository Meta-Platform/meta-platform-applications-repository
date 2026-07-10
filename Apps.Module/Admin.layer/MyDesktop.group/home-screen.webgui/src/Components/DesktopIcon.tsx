import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

import { IconPosition } from "../Utils/IconLayout"

// Ícone de aplicação na área de trabalho, posicionado em coordenadas absolutas
// (arrastável). A seleção e o arrasto são coordenados pelo container via
// onPointerDown; duplo-clique (ou Enter) abre a aplicação.
type LaunchInfo = { phase: "launching" | "window-ready" | "building" | "ready", percentage?: number }

type DesktopIconProps = {
    label: string
    title?: string
    iconUrl?: string
    selected: boolean
    instanceCount?: number
    launch?: LaunchInfo
    position: IconPosition
    dragging?: boolean
    onPointerDown: (e: React.PointerEvent) => void
    onOpen: () => void
    onContextMenu?: (e: React.MouseEvent) => void
}

const DesktopIcon = ({
    label, title, iconUrl, selected, instanceCount = 0, launch, position, dragging,
    onPointerDown, onOpen, onContextMenu
}:DesktopIconProps) => {

    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed

    // Ciclo de lançamento no ícone:
    //  - launching   → spinner (o app está subindo; janela ainda não abriu)
    //  - window-ready/building → barra de progresso (indeterminada sem %, ou
    //    acompanhando a porcentagem do build quando houver)
    //  - ready       → destaque de "aberto" (pulso), some depois de um instante
    const phase = launch && launch.phase
    const isSpinning  = phase === "launching"
    const isBuilding  = phase === "window-ready" || phase === "building"
    const isOpened    = phase === "ready"
    const hasPercent  = isBuilding && typeof launch!.percentage === "number"

    // Uma instância → marca de "em execução". Duas ou mais → o badge passa a
    // contar quantas janelas daquele aplicativo estão abertas.
    const isRunning = instanceCount > 0
    const hasManyInstances = instanceCount > 1
    const runningTitle = hasManyInstances ? `${instanceCount} instâncias em execução` : "Em execução"

    return <button
        type="button"
        className={`myd-icon ${selected ? "myd-icon--selected" : ""} ${dragging ? "myd-icon--dragging" : ""} ${isOpened ? "myd-icon--opened" : ""} ${isBuilding ? "myd-icon--building" : ""}`}
        style={{ left: position.x, top: position.y }}
        title={title || label}
        onPointerDown={onPointerDown}
        onDoubleClick={(e) => { e.stopPropagation(); onOpen() }}
        onContextMenu={(e) => { e.stopPropagation(); onContextMenu && onContextMenu(e) }}
        onKeyDown={(e) => { if(e.key === "Enter") onOpen() }}>

        <span className="myd-icon__frame">
            {
                isRunning &&
                <span className={`myd-icon__running ${hasManyInstances ? "myd-icon__running--count" : ""}`} title={runningTitle}>
                    { hasManyInstances && instanceCount }
                </span>
            }
            {
                showImage
                    ? <img className="myd-icon__img" src={iconUrl} alt={label} onError={() => setImageFailed(true)}/>
                    : <Icon name="desktop" className="myd-icon__glyph"/>
            }
            { isSpinning && <span className="myd-icon__spinner" title="Iniciando…"/> }
            {
                isBuilding &&
                <span className="myd-icon__progress" title="Carregando…">
                    <span
                        className={`myd-icon__progress-bar ${hasPercent ? "" : "myd-icon__progress-bar--indeterminate"}`}
                        style={hasPercent ? { width: `${Math.max(0, Math.min(100, launch!.percentage as number))}%` } : undefined}/>
                </span>
            }
        </span>
        <span className="myd-icon__label">{label}</span>
    </button>
}

export default DesktopIcon
