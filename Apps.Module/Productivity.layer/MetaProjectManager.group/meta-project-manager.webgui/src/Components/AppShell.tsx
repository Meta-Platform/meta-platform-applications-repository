import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import ProjectSidebar from "./ProjectSidebar"
import CommandBar from "./CommandBar"
import ThemeMenu from "./ThemeMenu"

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

        <div className={`mpm-body ${inspector ? "mpm-body--with-inspector" : ""}`}>
            <ProjectSidebar active={active} activeProjectId={activeProjectId} />
            <main className="mpm-content">{children}</main>
            {inspector ? inspector : null}
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
