import * as React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Icon } from "semantic-ui-react"

import ProjectSidebar from "./ProjectSidebar"
import CommandBar from "./CommandBar"
import ThemeMenu from "./ThemeMenu"
import GlobalApprovalModal from "./GlobalApprovalModal"

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

        <div className="mpm-body">
            <ProjectSidebar active={active} activeProjectId={activeProjectId} />
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
