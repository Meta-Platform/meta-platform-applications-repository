import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "semantic-ui-react"

// Popover "Todos os aplicativos", ancorado logo abaixo do botão de apps na
// barra do topo. Lista TODAS as aplicações instaladas em grade. Ações:
//  - clique  → lança o app;
//  - arrasto → cria atalho na área de trabalho/dock (o container orquestra o
//    drag por pointer events; aqui só disparamos onItemPointerDown);
//  - botão direito → menu (adicionar/remover atalho, desinstalar).
// Espelha ContextMenu.tsx: scrim que fecha ao clicar fora, clamp na viewport,
// fecha em Esc.

export type LauncherApp = {
    key: string
    label: string
    iconUrl?: string
    onDesktop: boolean
    onDock: boolean
    instanceCount?: number
}

type AppLauncherPopoverProps = {
    anchor: { x: number, y: number }
    apps: LauncherApp[]
    onLaunch: (key: string) => void
    onContextMenu: (e: React.MouseEvent, key: string) => void
    onItemPointerDown: (e: React.PointerEvent, key: string) => void
    onClose: () => void
}

const LauncherIcon = ({ app }: { app: LauncherApp }) => {
    const [ failed, setFailed ] = useState(false)
    const showImage = app.iconUrl && !failed
    return showImage
        ? <img className="myd-launcher__img" src={app.iconUrl} alt={app.label} onError={() => setFailed(true)}/>
        : <Icon name="desktop" className="myd-launcher__glyph"/>
}

const AppLauncherPopover = ({ anchor, apps, onLaunch, onContextMenu, onItemPointerDown, onClose }: AppLauncherPopoverProps) => {

    const ref = useRef<HTMLDivElement>(null)
    const [ pos, setPos ] = useState({ x: anchor.x, y: anchor.y })

    // Mantém o popover dentro da viewport (mesma lógica do ContextMenu).
    useEffect(() => {
        const el = ref.current
        if(!el) return
        const rect = el.getBoundingClientRect()
        const maxX = window.innerWidth - rect.width - 8
        const maxY = window.innerHeight - rect.height - 8
        setPos({ x: Math.max(8, Math.min(anchor.x, maxX)), y: Math.max(8, Math.min(anchor.y, maxY)) })
    }, [anchor.x, anchor.y, apps.length])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if(e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return <>
        <div className="myd-launcher-scrim" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }}/>
        <div ref={ref} className="myd-app-launcher" style={{ left: pos.x, top: pos.y }}>
            <div className="myd-app-launcher__head">Todos os aplicativos</div>
            {
                apps.length === 0
                    ? <div className="myd-app-launcher__empty">Nenhuma aplicação instalada.</div>
                    : <div className="myd-app-launcher__grid">
                        {
                            apps.map((app) =>
                                <button
                                    key={app.key}
                                    type="button"
                                    className="myd-launcher__item"
                                    title={app.label}
                                    onPointerDown={(e) => onItemPointerDown(e, app.key)}
                                    onClick={() => onLaunch(app.key)}
                                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, app.key) }}>
                                    <span className="myd-launcher__frame">
                                        <LauncherIcon app={app}/>
                                        {
                                            (app.onDesktop || app.onDock) &&
                                            <span className="myd-launcher__pins">
                                                { app.onDesktop && <Icon name="desktop" className="myd-launcher__pin"/> }
                                                { app.onDock && <Icon name="thumbtack" className="myd-launcher__pin"/> }
                                            </span>
                                        }
                                    </span>
                                    <span className="myd-launcher__label">{app.label}</span>
                                </button>)
                        }
                    </div>
            }
        </div>
    </>
}

export default AppLauncherPopover
