import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import ProjectSidebar from "./ProjectSidebar"
import CommandBar from "./CommandBar"
import ThemeMenu from "./ThemeMenu"
import useAppState from "../Hooks/useAppState"

interface AppShellProps {
    active: string
    activeProjectId?: string
    activeProjectName?: string
    inspector?: React.ReactNode
    onCreateProject?: () => void
    children: React.ReactNode
}

// AppShell (spec §11.1): Topbar + ProjectSidebar + área principal + Inspector
// lateral. Estrutura em grid; o Inspector só ocupa coluna quando presente.
const AppShell = ({ active, activeProjectId, activeProjectName, inspector, onCreateProject, children }: AppShellProps) => {
    const navigate = useNavigate()
    const [cmdOpen, setCmdOpen] = useState(false)

    // Feature 7: largura do inspector persistida no servidor (panelWidths).
    const [panelWidths, savePanelWidths] = useAppState<{ inspector?: number }>("panelWidths", {})
    const [width, setWidth] = useState<number>(380)
    const widthRef = useRef(width)
    widthRef.current = width
    useEffect(() => { if (panelWidths && panelWidths.inspector) setWidth(panelWidths.inspector) }, [panelWidths])

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault()
        const startX = e.clientX
        const startW = widthRef.current
        const onMove = (ev: MouseEvent) => {
            const w = Math.max(300, Math.min(720, startW - (ev.clientX - startX)))
            setWidth(w)
        }
        const onUp = () => {
            document.removeEventListener("mousemove", onMove)
            document.removeEventListener("mouseup", onUp)
            savePanelWidths({ ...(panelWidths || {}), inspector: widthRef.current })
        }
        document.addEventListener("mousemove", onMove)
        document.addEventListener("mouseup", onUp)
    }

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
                e.preventDefault(); setCmdOpen(true)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    return <div className="mpm-app">
        <header className="mpm-topbar">
            <div className="mpm-topbar__brand" onClick={() => navigate("/")}>
                <span className="mpm-topbar__logo">M</span>
                Meta Project Manager
            </div>
            {activeProjectName
                ? <div className="mpm-topbar__active">
                    <Icon name="folder open" /> {activeProjectName}
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

        <div className={`mpm-body ${inspector ? "mpm-body--with-inspector" : ""}`}
            style={inspector ? { gridTemplateColumns: `var(--mp-shell-sidebar-w) 1fr ${width}px` } : undefined}>
            <ProjectSidebar active={active} activeProjectId={activeProjectId} />
            <main className="mpm-content">{children}</main>
            {inspector
                ? <div className="mpm-inspector-wrap">
                    <div className="mpm-resizer" onMouseDown={startResize} title="Arraste para redimensionar" />
                    {inspector}
                </div>
                : null}
        </div>

        {cmdOpen
            ? <CommandBar
                onClose={() => setCmdOpen(false)}
                activeProjectId={activeProjectId}
                onCreateProject={onCreateProject} />
            : null}
    </div>
}

export default AppShell
