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
    running?: boolean
    launch?: LaunchInfo
    onOpen: () => void
    onContextMenu?: (e:React.MouseEvent) => void
}

const DockItem = ({ label, iconUrl, running, launch, onOpen, onContextMenu }:DockItemProps) => {
    const [ imageFailed, setImageFailed ] = useState(false)
    const showImage = iconUrl && !imageFailed

    const phase      = launch && launch.phase
    const isSpinning = phase === "launching"
    const isBuilding = phase === "window-ready" || phase === "building"
    const hasPercent = isBuilding && typeof launch!.percentage === "number"
    // ponto de "em execução" some enquanto há spinner/barra (evita dois badges no canto)
    const showRunDot = running && !isSpinning && !isBuilding

    return <button
        type="button"
        className={`myd-dock__item ${running ? "myd-dock__item--running" : ""} ${isBuilding ? "myd-dock__item--building" : ""}`}
        aria-label={running ? `${label} (em execução)` : label}
        onClick={onOpen}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu && onContextMenu(e) }}>
        <span className="myd-dock__label">{label}{ running && <span className="myd-dock__label-run">• em execução</span> }</span>
        { showRunDot && <span className="myd-dock__run-dot" title="em execução"/> }
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
    apps: Array<{ key:string, label:string, iconUrl?:string, running?:boolean, launch?:LaunchInfo, onOpen:()=>void, onContextMenu?:(e:React.MouseEvent)=>void }>
}

const Dock = ({ apps }:DockProps) => {
    if(apps.length === 0) return null
    return <div className="myd-dock-wrap">
        <div className="myd-dock">
            {
                apps.map((app) =>
                    <DockItem key={app.key} label={app.label} iconUrl={app.iconUrl}
                        running={app.running} launch={app.launch} onOpen={app.onOpen} onContextMenu={app.onContextMenu}/>)
            }
        </div>
    </div>
}

export default Dock
