import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { EmptyState, Icon, IconButton } from "@i-components"

import PaneContent from "./PaneContent"

import { IsTabs, LayoutNode, Pane, TabGroup, Workspace } from "./Model"

/**
 * Onde os painéis aparecem. Três arranjos, um host:
 *
 *   ancorado  — árvore de divisões, cada folha um grupo de abas
 *   flutuante — camada por cima, janelas arrastáveis
 *   mural     — grade de blocos
 *
 * O conteúdo é sempre o mesmo `PaneContent`; muda só a moldura. É isso que
 * permite mandar uma aba para flutuante (ou para o mural) sem que o log em
 * acompanhamento se reconecte e perca o que já recebeu.
 */

const PANE_ICON: any = {
    "overview":             "dashboard",
    "instances":            "server",
    "performance":          "chart line",
    "logs":                 "file alternate outline",
    "instance-summary":     "info circle",
    "instance-tasks":       "sitemap",
    "instance-log":         "file alternate outline",
    "instance-performance": "chart line"
}

// ---- Grupo de abas ------------------------------------------------------

// Onde a aba solta cai: no centro ela entra como mais uma aba do grupo; numa
// borda, cria a divisão daquele lado. É o gesto esperado de um workspace —
// arrastar o log para a metade direita e ficar com os dois lado a lado.
const DROP_EDGE_RATIO = 0.28

const _EdgeFromPoint = (bounds: DOMRect, x: number, y: number): "left" | "right" | "top" | "bottom" | "center" => {
    const relativeX = (x - bounds.left) / bounds.width
    const relativeY = (y - bounds.top) / bounds.height

    // A borda mais próxima ganha; o centro é a zona neutra (vira aba).
    const distances = [
        { edge: "left"   as const, distance: relativeX },
        { edge: "right"  as const, distance: 1 - relativeX },
        { edge: "top"    as const, distance: relativeY },
        { edge: "bottom" as const, distance: 1 - relativeY }
    ].sort((a, b) => a.distance - b.distance)

    return distances[0].distance <= DROP_EDGE_RATIO ? distances[0].edge : "center"
}

const TabGroupView = ({ group, workspace, actions, isOnly }: any) => {

    const panes: Pane[] = group.paneIds.map((paneId: string) => workspace.panes[paneId]).filter(Boolean)
    const activePane = workspace.panes[group.activePaneId] || panes[panes.length - 1]

    const [ dropZone, setDropZone ] = useState<string>()
    const bodyRef = useRef<HTMLDivElement>(null)

    const _ZoneFromEvent = (event: React.DragEvent) => {
        const element = bodyRef.current
        if (!element) return "center"
        return _EdgeFromPoint(element.getBoundingClientRect(), event.clientX, event.clientY)
    }

    const _OnDragOver = (event: React.DragEvent) => {
        event.preventDefault()
        setDropZone(_ZoneFromEvent(event))
    }

    const _OnDrop = (event: React.DragEvent) => {
        event.preventDefault()
        const zone = _ZoneFromEvent(event)
        setDropZone(undefined)

        const paneId = event.dataTransfer.getData("text/pane-id")
        if (!paneId) return

        if (zone === "center") actions.MovePaneToGroup(paneId, group.id)
        else actions.DropPaneOnEdge(paneId, group.id, zone)
    }

    return <div
        className={`iep-panegroup${dropZone ? " iep-panegroup--dropping" : ""}`}
        onDragOver={_OnDragOver}
        onDragLeave={() => setDropZone(undefined)}
        onDrop={_OnDrop}>

        <div className="iep-panetabs">
            {
                panes.map((pane) => <div
                    key={pane.id}
                    className={`iep-panetab${pane.id === (activePane && activePane.id) ? " iep-panetab--active" : ""}`}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/pane-id", pane.id)}
                    onClick={() => actions.SetActivePane(group.id, pane.id)}
                    title={pane.subtitle || pane.title}>
                    <Icon name={PANE_ICON[pane.kind] || "window maximize outline"}/>
                    <span className="iep-panetab__label">{pane.title}</span>
                    <Icon
                        name="close"
                        link
                        className="iep-panetab__close"
                        onClick={(event: any) => { event.stopPropagation(); actions.ClosePane(pane.id) }}/>
                </div>)
            }

            <span className="iep-barspacer"/>

            {
                activePane &&
                <div className="iep-panetabs__actions">
                    <IconButton
                        size="sm" icon="columns" label="dividir ao lado"
                        disabled={panes.length < 2}
                        onClick={() => actions.SplitGroup(group.id, activePane.id, "row")}/>
                    <IconButton
                        size="sm" icon="window minimize outline" label="dividir abaixo"
                        disabled={panes.length < 2}
                        onClick={() => actions.SplitGroup(group.id, activePane.id, "column")}/>
                    <IconButton
                        size="sm" icon="external" label="destacar em janela flutuante"
                        onClick={() => actions.FloatPane(activePane.id)}/>
                    <IconButton
                        size="sm" icon="th" label="fixar no mural"
                        onClick={() => actions.AddToGrid(activePane.id)}/>
                </div>
            }
        </div>

        <div className="iep-panebody" ref={bodyRef}>
            {
                dropZone &&
                <div className={`iep-dropzone iep-dropzone--${dropZone}`}>
                    <span className="iep-dropzone__hint">
                        {dropZone === "center" ? "abrir como aba" : "dividir aqui"}
                    </span>
                </div>
            }
            {
                activePane
                ? <PaneContent pane={activePane}/>
                : <EmptyState
                    icon={isOnly ? "window restore outline" : "add"}
                    title="área vazia"
                    message="abra um painel pela navegação à esquerda ou por uma instância da lista."/>
            }
        </div>
    </div>
}

// ---- Divisão ------------------------------------------------------------

const SplitView = ({ node, workspace, actions }: any) => {

    const containerRef = useRef<HTMLDivElement>(null)
    const dragRef = useRef<any>(null)

    const _StartResize = (index: number) => (event: React.MouseEvent) => {
        event.preventDefault()
        const container = containerRef.current
        if (!container) return
        const bounds = container.getBoundingClientRect()
        dragRef.current = {
            index,
            total: node.direction === "row" ? bounds.width : bounds.height,
            start: node.direction === "row" ? event.clientX : event.clientY,
            sizes: [...node.sizes]
        }
    }

    useEffect(() => {
        const _OnMove = (event: MouseEvent) => {
            const state = dragRef.current
            if (!state) return
            const position = node.direction === "row" ? event.clientX : event.clientY
            const delta = (position - state.start) / state.total

            const sizes = [...state.sizes]
            // Piso de 12%: sem ele, arrastar até o fim faz o painel sumir sem
            // como trazê-lo de volta.
            const next = Math.min(Math.max(sizes[state.index] + delta, 0.12), sizes[state.index] + sizes[state.index + 1] - 0.12)
            const consumed = next - sizes[state.index]
            sizes[state.index] = next
            sizes[state.index + 1] -= consumed
            actions.ResizeSplit(node.id, sizes)
        }
        const _OnUp = () => { dragRef.current = null }

        document.addEventListener("mousemove", _OnMove)
        document.addEventListener("mouseup", _OnUp)
        return () => {
            document.removeEventListener("mousemove", _OnMove)
            document.removeEventListener("mouseup", _OnUp)
        }
    }, [node, actions])

    return <div
        ref={containerRef}
        className={`iep-split-node iep-split-node--${node.direction}`}>
        {
            node.children.map((child: LayoutNode, index: number) => <React.Fragment key={child.id}>
                <div className="iep-split-node__child" style={{ flexGrow: node.sizes[index] || 1 }}>
                    <LayoutView node={child} workspace={workspace} actions={actions}/>
                </div>
                {
                    index < node.children.length - 1 &&
                    <div
                        className={`iep-splitter iep-splitter--${node.direction}`}
                        onMouseDown={_StartResize(index)}/>
                }
            </React.Fragment>)
        }
    </div>
}

const LayoutView = ({ node, workspace, actions, isOnly }: any) =>
    IsTabs(node)
        ? <TabGroupView group={node as TabGroup} workspace={workspace} actions={actions} isOnly={isOnly}/>
        : <SplitView node={node} workspace={workspace} actions={actions}/>

// ---- Janela flutuante ---------------------------------------------------

const FloatingWindow = ({ placement, pane, actions }: any) => {

    const dragRef = useRef<any>(null)

    const _Start = (mode: "move" | "resize") => (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        dragRef.current = {
            mode,
            startX: event.clientX,
            startY: event.clientY,
            box: { x: placement.x, y: placement.y, width: placement.width, height: placement.height }
        }
        actions.FocusPane(pane.id)
    }

    useEffect(() => {
        const _OnMove = (event: MouseEvent) => {
            const state = dragRef.current
            if (!state) return
            const dx = event.clientX - state.startX
            const dy = event.clientY - state.startY

            if (state.mode === "move")
                actions.MoveFloating(pane.id, { x: Math.max(0, state.box.x + dx), y: Math.max(0, state.box.y + dy) })
            else
                actions.MoveFloating(pane.id, {
                    width:  Math.max(260, state.box.width + dx),
                    height: Math.max(160, state.box.height + dy)
                })
        }
        const _OnUp = () => { dragRef.current = null }

        document.addEventListener("mousemove", _OnMove)
        document.addEventListener("mouseup", _OnUp)
        return () => {
            document.removeEventListener("mousemove", _OnMove)
            document.removeEventListener("mouseup", _OnUp)
        }
    }, [pane.id, actions])

    return <div
        className="iep-floating"
        style={{ left: placement.x, top: placement.y, width: placement.width, height: placement.height, zIndex: 40 + placement.z }}
        onMouseDown={() => actions.FocusPane(pane.id)}>

        <div className="iep-floating__bar" onMouseDown={_Start("move")}>
            <Icon name={PANE_ICON[pane.kind] || "window maximize outline"}/>
            <span className="iep-floating__title" title={pane.subtitle || pane.title}>{pane.title}</span>
            <span className="iep-barspacer"/>
            <IconButton
                size="sm" icon="window restore outline" label="reancorar"
                onClick={() => actions.DockPane(pane.id)}/>
            <IconButton
                size="sm" icon="close" label="fechar"
                onClick={() => actions.ClosePane(pane.id)}/>
        </div>

        <div className="iep-floating__body">
            <PaneContent pane={pane}/>
        </div>

        <div className="iep-floating__resizer" onMouseDown={_Start("resize")}/>
    </div>
}

// ---- Mural --------------------------------------------------------------

const GRID_COLUMNS = 12
const GRID_ROW_HEIGHT = 42

const WidgetGrid = ({ workspace, actions }: any) => {

    const dragRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const _Start = (paneId: string, mode: "move" | "resize", placement: any) => (event: React.MouseEvent) => {
        event.preventDefault()
        const container = containerRef.current
        if (!container) return
        dragRef.current = {
            paneId, mode, placement,
            startX: event.clientX,
            startY: event.clientY,
            columnWidth: container.clientWidth / GRID_COLUMNS
        }
    }

    useEffect(() => {
        const _OnMove = (event: MouseEvent) => {
            const state = dragRef.current
            if (!state) return
            const dx = Math.round((event.clientX - state.startX) / state.columnWidth)
            const dy = Math.round((event.clientY - state.startY) / GRID_ROW_HEIGHT)

            if (state.mode === "move")
                actions.MoveGridWidget(state.paneId, {
                    x: Math.min(Math.max(0, state.placement.x + dx), GRID_COLUMNS - state.placement.w),
                    y: Math.max(0, state.placement.y + dy)
                })
            else
                actions.MoveGridWidget(state.paneId, {
                    w: Math.min(Math.max(2, state.placement.w + dx), GRID_COLUMNS - state.placement.x),
                    h: Math.max(3, state.placement.h + dy)
                })
        }
        const _OnUp = () => { dragRef.current = null }

        document.addEventListener("mousemove", _OnMove)
        document.addEventListener("mouseup", _OnUp)
        return () => {
            document.removeEventListener("mousemove", _OnMove)
            document.removeEventListener("mouseup", _OnUp)
        }
    }, [actions])

    if (workspace.grid.length === 0)
        return <EmptyState
            icon="th"
            title="mural vazio"
            message="abra um painel e use “fixar no mural” para montar seu acompanhamento."/>

    return <div className="iep-widgetgrid" ref={containerRef}>
        {
            workspace.grid.map((placement: any) => {
                const pane = workspace.panes[placement.paneId]
                if (!pane) return null
                return <div
                    key={placement.paneId}
                    className="iep-widget"
                    style={{
                        gridColumn: `${placement.x + 1} / span ${placement.w}`,
                        gridRow: `${placement.y + 1} / span ${placement.h}`
                    }}>
                    <div className="iep-widget__bar" onMouseDown={_Start(placement.paneId, "move", placement)}>
                        <Icon name={PANE_ICON[pane.kind] || "window maximize outline"}/>
                        <span className="iep-widget__title" title={pane.subtitle || pane.title}>{pane.title}</span>
                        <span className="iep-barspacer"/>
                        <IconButton
                            size="sm" icon="expand" label="abrir como aba"
                            onClick={() => actions.DockPane(placement.paneId)}/>
                        <IconButton
                            size="sm" icon="close" label="tirar do mural"
                            onClick={() => actions.RemoveFromGrid(placement.paneId)}/>
                    </div>
                    <div className="iep-widget__body">
                        <PaneContent pane={pane}/>
                    </div>
                    <div className="iep-widget__resizer" onMouseDown={_Start(placement.paneId, "resize", placement)}/>
                </div>
            })
        }
    </div>
}

// ---- Host ---------------------------------------------------------------

const WorkspaceHost = ({ workspace, actions }: { workspace: Workspace, actions: any }) => {

    const _RenderDocked = useCallback(
        () => <LayoutView node={workspace.layout} workspace={workspace} actions={actions} isOnly={true}/>,
        [workspace, actions])

    return <div className="iep-workspace">
        <div className="iep-workspace__surface">
            { workspace.mode === "grid" ? <WidgetGrid workspace={workspace} actions={actions}/> : _RenderDocked() }
        </div>

        {
            workspace.floating.map((placement) => {
                const pane = workspace.panes[placement.paneId]
                if (!pane) return null
                return <FloatingWindow key={placement.paneId} placement={placement} pane={pane} actions={actions}/>
            })
        }
    </div>
}

export default WorkspaceHost
