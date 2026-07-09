import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import useAppState from "../Hooks/useAppState"
import ProjectSidebar from "./ProjectSidebar"
import CommandBar from "./CommandBar"
import ThemeMenu from "./ThemeMenu"
import GlobalApprovalModal from "./GlobalApprovalModal"

// Estado persistido da sidebar (largura + colapsada), guardado no servidor
// via AppState — sobrevive ao restart do app.
interface SidebarState { width: number; collapsed: boolean }
const SIDEBAR_DEFAULT: SidebarState = { width: 240, collapsed: false }
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420
const SIDEBAR_RAIL = 60

interface AppShellProps {
    active: string
    activeProjectId?: string
    activeProjectName?: string
    inspector?: React.ReactNode
    onInspectorClose?: () => void
    onCreateProject?: () => void
    children: React.ReactNode
}

// AppShell (spec §11.1): Topbar + ProjectSidebar + área principal. Ao abrir uma
// tarefa, o Inspector é exibido como MODAL CENTRALIZADO (overlay), não como
// painel lateral. Fecha por Esc ou clique fora (onInspectorClose) e pelo X do inspector.
const AppShell = ({ active, activeProjectId, activeProjectName, inspector, onInspectorClose, onCreateProject, children }: AppShellProps) => {
    const navigate = useNavigate()
    const [cmdOpen, setCmdOpen] = useState(false)
    const [sidebar, saveSidebar] = useAppState<SidebarState>("mpm.sidebar", SIDEBAR_DEFAULT)
    const [dragWidth, setDragWidth] = useState<number | null>(null)
    const draggingRef = useRef(false)

    const collapsed = !!sidebar.collapsed
    // Durante o arraste usamos o valor local (sem gravar a cada pixel).
    const width = collapsed ? SIDEBAR_RAIL : (dragWidth ?? sidebar.width ?? SIDEBAR_DEFAULT.width)

    const toggleCollapsed = () => saveSidebar({ width: sidebar.width || SIDEBAR_DEFAULT.width, collapsed: !collapsed })

    // Arraste da borda: atualiza local no mousemove, PERSISTE só no mouseup.
    const startDrag = useCallback((e: React.MouseEvent) => {
        if (collapsed) return
        e.preventDefault()
        draggingRef.current = true
        const onMove = (ev: MouseEvent) => {
            if (!draggingRef.current) return
            const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX))
            setDragWidth(next)
        }
        const onUp = (ev: MouseEvent) => {
            draggingRef.current = false
            const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX))
            setDragWidth(null)
            saveSidebar({ width: next, collapsed: false })
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

    // Ctrl+B alterna a sidebar (padrão de IDE).
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

    // Esc fecha o modal do inspector quando aberto.
    useEffect(() => {
        if (!inspector || !onInspectorClose) return
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onInspectorClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [inspector, onInspectorClose])

    return <div className="mpm-app" style={{ ["--mpm-sidebar-w" as any]: `${width}px` }}>
        <header className="mpm-topbar">
            <span className="mpm-iconbtn" title={`${collapsed ? "Expandir" : "Minimizar"} menu lateral (Ctrl+B)`}
                onClick={toggleCollapsed}>
                <Icon name={collapsed ? "indent" : "outdent"} />
            </span>
            <div className="mpm-topbar__brand" onClick={() => navigate("/")}>
                <span className="mpm-topbar__logo">M</span>
                Meta Project Manager
            </div>
            {activeProjectName
                ? <div className="mpm-topbar__active" title={activeProjectName}>
                    <Icon name="folder open" /> <span>{activeProjectName}</span>
                </div>
                : null}
            <div className="mpm-topbar__spacer" />
            <div className="mpm-topbar__search" onClick={() => setCmdOpen(true)}>
                <Icon name="search" />
                <span className="mpm-muted" style={{ flex: 1 }}>Buscar / comandos</span>
                <span className="mpm-kbd">Ctrl K</span>
            </div>
            <ThemeMenu />
        </header>

        <div className={`mpm-body ${collapsed ? "is-sidebar-collapsed" : ""}`}>
            <ProjectSidebar active={active} activeProjectId={activeProjectId} collapsed={collapsed} />
            {/* Alça de redimensionamento (arraste a borda direita da sidebar) */}
            {!collapsed
                ? <div className="mpm-sidebar__resizer" onMouseDown={startDrag}
                    title="Arraste para redimensionar" role="separator" aria-orientation="vertical" />
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

        {/* Aprovação de agente é GLOBAL: surge sobre qualquer tela quando há
            pedidos pendentes (criação/remoção), sem depender da tela de Agentes. */}
        <GlobalApprovalModal />
    </div>
}

export default AppShell
