import * as React from "react"
import { useState } from "react"
import { Icon } from "semantic-ui-react"

// Item do dock: ícone pequeno com fallback de glifo, rótulo em balão ao passar
// o mouse, ciclo de lançamento (spinner → barra de build), indicador discreto de
// "em execução" no canto e menu de contexto (botão direito).
type LaunchInfo = { phase: "launching" | "window-ready" | "building" | "ready", percentage?: number }

type DockItemProps = {
    label: string
    iconUrl?: string
    instanceCount?: number
    launch?: LaunchInfo
    onOpen: () => void
    onContextMenu?: (e:React.MouseEvent) => void
}

const DockItem = ({ label, iconUrl, instanceCount = 0, launch, onOpen, onContextMenu }:DockItemProps) => {
    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed

    const phase      = launch && launch.phase
    const isSpinning = phase === "launching"
    const isBuilding = phase === "window-ready" || phase === "building"
    const hasPercent = isBuilding && typeof launch!.percentage === "number"

    // Uma instância → ponto de "em execução". Duas ou mais → o badge conta as
    // janelas abertas daquele aplicativo.
    const isRunning        = instanceCount > 0
    const hasManyInstances = instanceCount > 1
    // o badge some enquanto há spinner/barra (evita dois badges no canto)
    const showRunDot = isRunning && !isSpinning && !isBuilding
    const runLabel = hasManyInstances ? `${instanceCount} em execução` : "em execução"

    return <button
        type="button"
        className={`myd-dock__item ${isRunning ? "myd-dock__item--running" : ""} ${isBuilding ? "myd-dock__item--building" : ""}`}
        aria-label={isRunning ? `${label} (${runLabel})` : label}
        onClick={onOpen}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e) }}>
        <span className="myd-dock__label">{label}{ isRunning && <span className="myd-dock__label-run">• {runLabel}</span> }</span>
        {
            showRunDot &&
            <span className={`myd-dock__run-dot ${hasManyInstances ? "myd-dock__run-dot--count" : ""}`} title={runLabel}>
                { hasManyInstances && instanceCount }
            </span>
        }
        {
            showImage
                ? <img className="myd-dock__img" src={iconUrl} alt={label} onError={() => setImageFailed(true)}/>
                : <Icon name="desktop" className="myd-dock__glyph"/>
        }
        { isSpinning && <span className="myd-dock__spinner" title="Iniciando…"/> }
        {
            isBuilding &&
            <span className="myd-dock__progress" title="Carregando…">
                <span
                    className={`myd-dock__progress-bar ${hasPercent ? "" : "myd-dock__progress-bar--indeterminate"}`}
                    style={hasPercent ? { width: `${Math.max(0, Math.min(100, launch!.percentage as number))}%` } : undefined}/>
            </span>
        }
    </button>
}

// Dock inferior centralizado com os apps instalados. Clique lança a aplicação;
// botão direito abre o menu de contexto (abrir / encerrar / remover).
type DockProps = {
    apps: Array<{ key:string, label:string, iconUrl?:string, instanceCount?:number, launch?:LaunchInfo, onOpen:()=>void, onContextMenu?:(e:React.MouseEvent)=>void }>
}

const Dock = ({ apps }:DockProps) => {
    if(apps.length === 0) return null
    return <div className="myd-dock-wrap">
        <div className="myd-dock">
            {
                apps.map((app) =>
                    <DockItem key={app.key} label={app.label} iconUrl={app.iconUrl}
                        instanceCount={app.instanceCount} launch={app.launch} onOpen={app.onOpen} onContextMenu={app.onContextMenu}/>)
            }
        </div>
    </div>
}

export default Dock
