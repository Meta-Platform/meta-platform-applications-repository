import * as React from "react"
import { useState } from "react"
import { Icon, Popover } from "@i-components"

// Popover "Todos os aplicativos", ancorado logo abaixo do botão de apps na
// barra do topo. Lista TODAS as aplicações instaladas em grade. Ações:
//  - clique  → lança o app;
//  - arrasto → cria atalho na área de trabalho/dock (o container orquestra o
//    drag por pointer events; aqui só disparamos onItemPointerDown);
//  - botão direito → menu (adicionar/remover atalho, desinstalar).
//
// A caixa (scrim, painel, sombra, fechar no Esc/clique fora) é o `Popover` do
// kit; o âncora fixo em x,y é que é da área de trabalho — o gatilho vive na
// barra de sistema, mas o popover é montado no nível do desktop para o
// hit-test do arrasto cross-surface enxergá-lo.

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

// O ícone do pacote chega por protocolo (metaicon://) — é regra de domínio da
// área de trabalho, e por isso continua sendo <img> daqui, não um ícone do kit.
const LauncherIcon = ({ app }: { app: LauncherApp }) => {
    const [ failed, setFailed ] = useState(false)
    const showImage = app.iconUrl && !failed
    return showImage
        ? <img className="myd-launcher__img" src={app.iconUrl} alt={app.label} onError={() => setFailed(true)}/>
        : <Icon name="desktop" className="myd-launcher__glyph"/>
}

const AppLauncherPopover = ({ anchor, apps, onLaunch, onContextMenu, onItemPointerDown, onClose }: AppLauncherPopoverProps) => {

    // O âncora tem tamanho zero: o painel do kit se alinha pela BORDA DIREITA
    // dele (align="right"), que é a borda direita do botão de apps.
    return <div className="myd-launcher-anchor" style={{ left: anchor.x, top: anchor.y }}>
        <Popover open align="right" onClose={onClose}>
            <div className="myd-app-launcher">
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
        </Popover>
    </div>
}

export default AppLauncherPopover
