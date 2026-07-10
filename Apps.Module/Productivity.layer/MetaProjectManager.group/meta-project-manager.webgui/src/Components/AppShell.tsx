import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useAppState from "../Hooks/useAppState"
import NavRail from "./NavRail"
import ProjectColumn from "./ProjectColumn"
import CommandBar from "./CommandBar"
import ThemeMenu from "./ThemeMenu"
import GlobalApprovalModal from "./GlobalApprovalModal"
import ToastStack from "./ToastStack"
import useApprovalQueue from "../Hooks/useApprovalQueue"
import { HandleZoomShortcut, GetSavedZoom } from "../Utils/zoom"

// Estado persistido da coluna do projeto (largura + colapsada), guardado no
// servidor via AppState — sobrevive ao restart do app. O rail é sempre visível.
interface SidebarState { width: number; collapsed: boolean }
const SIDEBAR_DEFAULT: SidebarState = { width: 240, collapsed: false }
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const RAIL_W = 64

export interface Crumb { label: string; to?: string }

interface AppShellProps {
    active: string
    activeProjectId?: string
    activeProjectName?: string
    // Header: trilha, título em destaque e ações da página.
    breadcrumb?: Crumb[]
    title?: React.ReactNode
    subtitle?: React.ReactNode
    actions?: React.ReactNode
    inspector?: React.ReactNode
    onInspectorClose?: () => void
    onCreateProject?: () => void
    children: React.ReactNode
}

// AppShell: Header (trilha + título) + NavRail (global) + ProjectColumn (projeto
// atual) + área principal. Ao abrir uma tarefa, o Inspector é exibido como MODAL
// CENTRALIZADO (overlay). Fecha por Esc ou clique fora (onInspectorClose).
const AppShell = ({ active, activeProjectId, activeProjectName, breadcrumb, title, subtitle, actions,
    inspector, onInspectorClose, onCreateProject, children }: AppShellProps) => {
    const navigate = useNavigate()
    const { snoozedCount, resumeAll } = useApprovalQueue()
    const [cmdOpen, setCmdOpen] = useState(false)
    const [sidebar, saveSidebar] = useAppState<SidebarState>("mpm.sidebar", SIDEBAR_DEFAULT)
    const [dragWidth, setDragWidth] = useState<number | null>(null)
    const draggingRef = useRef(false)

    const collapsed = !!sidebar.collapsed
    // Durante o arraste usamos o valor local (sem gravar a cada pixel).
    const width = collapsed ? 0 : (dragWidth ?? sidebar.width ?? SIDEBAR_DEFAULT.width)

    const toggleCollapsed = () => saveSidebar({ width: sidebar.width || SIDEBAR_DEFAULT.width, collapsed: !collapsed })

    // Arraste da borda: atualiza local no mousemove, PERSISTE só no mouseup.
    // clientX desconta o rail, que fica à esquerda da coluna.
    const startDrag = useCallback((e: React.MouseEvent) => {
        if (collapsed) return
        e.preventDefault()
        draggingRef.current = true
        const clamp = (x: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, x - RAIL_W))
        const onMove = (ev: MouseEvent) => { if (draggingRef.current) setDragWidth(clamp(ev.clientX)) }
        const onUp = (ev: MouseEvent) => {
            draggingRef.current = false
            setDragWidth(null)
            saveSidebar({ width: clamp(ev.clientX), collapsed: false })
            window.removeEventListener("mousemove", onMove)
            window.removeEventListener("mouseup", onUp)
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
        }
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"
        window.addEventListener("mousemove", onMove)
        window.addEventListener("mouseup", onUp)
    }, [collapsed, saveSidebar])

    // Ctrl+B alterna a coluna do projeto (padrão de IDE).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) { e.preventDefault(); toggleCollapsed() }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [collapsed, sidebar.width])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
                e.preventDefault(); setCmdOpen(true)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    // Ctrl + "+" / "-" / "0": aumenta, diminui e restaura a fonte da interface,
    // como num editor. A escolha fica salva e é reaplicada no próximo boot.
    const [zoom, setZoom] = useState(GetSavedZoom())
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const next = HandleZoomShortcut(e)
            if (next !== null) setZoom(next)
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])
    // Mostra o nível por um instante depois de mudar (feedback do atalho).
    const [showZoom, setShowZoom] = useState(false)
    useEffect(() => {
        if (zoom === 1 && !showZoom) return
        setShowZoom(true)
        const timer = setTimeout(() => setShowZoom(false), 1200)
        return () => clearTimeout(timer)
    }, [zoom])

    // Esc fecha o modal do inspector quando aberto.
    useEffect(() => {
        if (!inspector || !onInspectorClose) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onInspectorClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [inspector, onInspectorClose])

    const crumbs: Crumb[] = breadcrumb && breadcrumb.length > 0
        ? breadcrumb
        : activeProjectName
        ? [{ label: "Projetos", to: "/" }, { label: activeProjectName }]
        : [{ label: "Projetos", to: "/" }]

    return <div className="mpm-app" style={{ ["--mpm-sidebar-w" as any]: `${width}px` }}>
        <header className="mpm-header">
            {/* Linha 1: identidade, trilha e ferramentas globais */}
            <div className="mpm-header__top">
                <span className="mpm-iconbtn" title={`${collapsed ? "Mostrar" : "Ocultar"} menu do projeto (Ctrl+B)`}
                    onClick={toggleCollapsed}>
                    <Icon name={collapsed ? "indent" : "outdent"} />
                </span>
                <div className="mpm-header__logo" title="Meta Project Manager" onClick={() => navigate("/")}>M</div>

                <nav className="mpm-crumbs" aria-label="Trilha">
                    {crumbs.map((c, i) => {
                        const to = c.to
                        return <span key={i} className="mpm-crumbs__part">
                            {i > 0 ? <span className="mpm-crumbs__sep">/</span> : null}
                            {to
                                ? <a className="mpm-crumbs__link" onClick={() => navigate(to)}>{c.label}</a>
                                : <span className="mpm-crumbs__current">{c.label}</span>}
                        </span>
                    })}
                </nav>

                <div className="mpm-header__spacer" />

                {/* Pedido adiado: o agente segue parado, então o aviso pisca até ser resolvido. */}
                {snoozedCount > 0
                    ? <button className="mpm-approval-nag" onClick={resumeAll}
                        title="Um agente está parado esperando sua decisão">
                        <Icon name="hourglass half" />
                        {snoozedCount === 1 ? "1 aprovação pendente" : `${snoozedCount} aprovações pendentes`}
                        <span className="mpm-approval-nag__cta">revisar</span>
                    </button>
                    : null}

                <div className="mpm-topbar__search" onClick={() => setCmdOpen(true)}>
                    <Icon name="search" />
                    <span className="mpm-muted" style={{ flex: 1 }}>Buscar / comandos</span>
                    <span className="mpm-kbd">Ctrl K</span>
                </div>
                <ThemeMenu />
            </div>

            {/* Linha 2: título da tela em destaque + ações. */}
            {title
                ? <div className="mpm-header__title-row">
                    <div className="mpm-header__titles">
                        <h1 className="mpm-page-title">{title}</h1>
                        {subtitle ? <div className="mpm-page-subtitle">{subtitle}</div> : null}
                    </div>
                    {actions ? <div className="mpm-header__actions">{actions}</div> : null}
                </div>
                : null}
        </header>

        <div className={`mpm-body ${collapsed ? "is-sidebar-collapsed" : ""}`}>
            <NavRail active={active} />
            {!collapsed
                ? <>
                    <ProjectColumn active={active} activeProjectId={activeProjectId} onCreateProject={onCreateProject} />
                    {/* Alça de redimensionamento (arraste a borda direita da coluna) */}
                    <div className="mpm-sidebar__resizer" onMouseDown={startDrag}
                        title="Arraste para redimensionar" role="separator" aria-orientation="vertical" />
                </>
                : null}
            <main className="mpm-content">{children}</main>
        </div>

        {inspector
            ? <div className="mpm-overlay"
                onMouseDown={(e) => { if (e.target === e.currentTarget && onInspectorClose) onInspectorClose() }}>
                <div className="mpm-modal mpm-modal--inspector" role="dialog" aria-modal="true">
                    {inspector}
                </div>
            </div>
            : null}

        {cmdOpen
            ? <CommandBar
                onClose={() => setCmdOpen(false)}
                activeProjectId={activeProjectId}
                onCreateProject={onCreateProject} />
            : null}

        {showZoom
            ? <div className="mpm-zoom-hud">{Math.round(zoom * 100)}%</div>
            : null}

        {/* Toasts do que os agentes fazem: ficam aqui para que "abrir" use o
            ItemNavigator da tela atual. */}
        <ToastStack />

        {/* Aprovação de agente é GLOBAL: surge sobre QUALQUER tela e sobre qualquer
            outro modal — é a única coisa que prende o agente do outro lado. */}
        <GlobalApprovalModal />
    </div>
}

export default AppShell
