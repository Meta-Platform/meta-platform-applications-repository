import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import ReactFlow, {
    Background, ConnectionLineType, Controls, MiniMap, Panel, ReactFlowProvider,
    useEdgesState, useNodesInitialized, useNodesState, useReactFlow
} from "reactflow"
import "reactflow/dist/style.css"

import { EmptyState } from "@i-components"

import { GraphScope, RuntimeGraph, buildRuntimeGraph, collectNodeKinds } from "../../../Domain/runtimeGraph"
import { PackageModel } from "../../../Domain/packageModel"
import { EDGE_THEME, NODE_THEME } from "./diagramTheme"
import BootFlowNode from "./BootFlowNode"
import layoutGraph from "./layoutGraph"
import { IconButton, Segmented } from "../ui/Primitives"

// Diagrama da topologia de uma capacidade do runtime — do boot inteiro a uma
// seção só (endpoints, serviços, comandos…). Interativo: zoom, pan, ajustar à
// tela, centralizar, minimapa, legenda e destaque da vizinhança. Clicar num nó
// seleciona o recurso no Inspector; selecionar fora CENTRALIZA o nó aqui.

const nodeTypes = { boot: BootFlowNode }

// "Ajustar à tela" faz o que promete: cabe tudo. Já a ABERTURA prioriza leitura —
// enquadra e, se o grafo for grande demais para ficar legível, sobe o zoom até o
// mínimo confortável e deixa o usuário navegar (pan/minimapa).
const FIT_OPTIONS = { padding: 0.15, maxZoom: 1, duration: 200 }
const MIN_READABLE_ZOOM = 0.5

type Props = {
    model        : PackageModel
    scope?       : GraphScope      // "boot" (padrão) ou uma seção do runtime
    selectedId?  : string          // id do item do modelo atualmente selecionado
    onSelectItem : (itemId:string) => void
    onOpenRef?   : (target:string) => void   // navegar para o pacote de um nó
    emptyHint?   : string
}

type CanvasProps = {
    graph : RuntimeGraph
    selectedId? : string
    onSelectItem : (id:string) => void
    onOpenRef? : (target:string) => void
    fullscreen? : boolean
    onToggleFullscreen? : () => void
}

const Canvas = ({ graph, selectedId, onSelectItem, onOpenRef, fullscreen, onToggleFullscreen }:CanvasProps) => {

    // Ficha do nó sob o cursor (posição em coordenadas do contêiner).
    const [hover, setHover] = useState<{ node:any, x:number, y:number } | undefined>()

    const [direction, setDirection] = useState<"LR" | "TB">("LR")
    const layouted = useMemo(() => layoutGraph(graph, direction), [graph, direction])
    const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes as any)
    const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges as any)
    const { fitView, setCenter, getNode, getZoom, zoomTo } = useReactFlow()

    useEffect(() => {
        setNodes(layouted.nodes as any)
        setEdges(layouted.edges as any)
    }, [layouted])

    // O enquadramento só é possível depois que o reactflow mede os nós; antes
    // disso qualquer fitView é ignorado (por isso o hook, não um setTimeout).
    const nodesInitialized = useNodesInitialized()
    useEffect(() => {
        if(!nodesInitialized) return
        fitView({ ...FIT_OPTIONS, duration: 0 })
        if(getZoom() < MIN_READABLE_ZOOM) zoomTo(MIN_READABLE_ZOOM, { duration: 200 })
    }, [nodesInitialized, layouted])

    const selectedNodeId = useMemo(() => {
        if(!selectedId) return undefined
        const hit = graph.nodes.filter((n) => n.itemId === selectedId)[0]
        return hit && hit.id
    }, [graph, selectedId])

    // Destaque do caminho: o nó selecionado e seus vizinhos ficam nítidos.
    useEffect(() => {
        const neighbours:{[id:string]:boolean} = {}
        if(selectedNodeId){
            neighbours[selectedNodeId] = true
            graph.edges.forEach((e) => {
                if(e.source === selectedNodeId) neighbours[e.target] = true
                if(e.target === selectedNodeId) neighbours[e.source] = true
            })
        }
        setNodes((current:any[]) => current.map((n) => ({
            ...n,
            data: {
                ...n.data,
                highlighted : !!selectedNodeId && n.id === selectedNodeId,
                dimmed      : !!selectedNodeId && !neighbours[n.id]
            }
        })))
        setEdges((current:any[]) => current.map((e:any) => ({
            ...e,
            style: { ...e.style, opacity: !selectedNodeId || e.source === selectedNodeId || e.target === selectedNodeId ? 1 : 0.15 }
        })))
    }, [selectedNodeId, graph])

    const centerSelection = useCallback(() => {
        if(!selectedNodeId) return fitView(FIT_OPTIONS)
        const node:any = getNode(selectedNodeId)
        if(node) setCenter(node.position.x + 115, node.position.y + 36, { zoom: 1.1, duration: 250 })
    }, [selectedNodeId, getNode, setCenter, fitView])

    // Selecionar um recurso na árvore/lista traz o nó dele para o centro — é o
    // que faz o diagrama valer como visão principal, e não como enfeite.
    useEffect(() => {
        if(!selectedNodeId || !nodesInitialized) return
        const node:any = getNode(selectedNodeId)
        if(node) setCenter(node.position.x + 115, node.position.y + 36, { zoom: 1, duration: 250 })
    }, [selectedNodeId, nodesInitialized])

    // Clique: item → seleciona no Inspector; pacote provedor → NAVEGA para ele.
    const onNodeClick = useCallback((_e:any, node:any) => {
        const data = node && node.data
        if(!data) return
        if(data.itemId) return onSelectItem(data.itemId)
        if(data.packageRef && onOpenRef) onOpenRef(data.packageRef)
    }, [onSelectItem, onOpenRef])

    const onNodeMouseEnter = useCallback((event:any, node:any) => {
        const box = event.currentTarget.closest(".pdx-diagram")
        const rect = box ? box.getBoundingClientRect() : { left: 0, top: 0 }
        setHover({ node, x: event.clientX - rect.left, y: event.clientY - rect.top })
    }, [])
    const onNodeMouseLeave = useCallback(() => setHover(undefined), [])

    const kinds = useMemo(() => collectNodeKinds(graph.nodes), [graph])
    const edgeKinds = useMemo(() => {
        const out:string[] = []
        graph.edges.forEach((e) => { if(out.indexOf(e.kind) < 0) out.push(e.kind) })
        return out
    }, [graph])

    return <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={() => setHover(undefined)}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodesConnectable={false}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}>

        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap position="bottom-right" pannable zoomable
            style={{ background: "var(--mp-paper-2)", border: "1px solid var(--mp-line-soft)" }}
            nodeColor={(n:any) => (NODE_THEME[n.data && n.data.kind] || NODE_THEME["section"]).accent} />

        <Panel position="top-left">
            <div className="pdx-inline">
                <IconButton icon="expand arrows alternate" label="Ajustar à tela" text="Ajustar" onClick={() => fitView(FIT_OPTIONS)} />
                <IconButton icon="crosshairs" label="Centralizar seleção" text="Centralizar" onClick={centerSelection} disabled={!selectedNodeId} />
                <Segmented ariaLabel="Direção do layout" value={direction} onChange={setDirection}
                    options={[{ value: "LR", label: "horizontal" }, { value: "TB", label: "vertical" }]} />
                {
                    onToggleFullscreen &&
                    <IconButton icon={fullscreen ? "compress" : "expand"}
                        label={fullscreen ? "Sair da tela cheia (Esc)" : "Ver o diagrama em tela cheia"}
                        text={fullscreen ? "Recolher" : "Expandir"}
                        onClick={onToggleFullscreen} />
                }
            </div>
        </Panel>

        <Panel position="top-right">
            <div className="pdx-legend">
                <div className="pdx-legend__title">Legenda</div>
                {
                    kinds.map((kind) =>
                        <div className="pdx-legend__row" key={kind}>
                            <span className="pdx-legend__swatch" style={{ borderColor: NODE_THEME[kind].accent }} />
                            <span>{NODE_THEME[kind].label}</span>
                        </div>)
                }
                {
                    edgeKinds.length > 0 &&
                    <div style={{borderTop:"1px solid var(--mp-line-faint)", marginTop:6, paddingTop:6}}>
                        {
                            edgeKinds.map((kind:any) =>
                                <div className="pdx-legend__row" key={kind}>
                                    <span className="pdx-legend__line"
                                        style={{ borderTop: `2px ${EDGE_THEME[kind].dashed ? "dashed" : "solid"} ${EDGE_THEME[kind].color}` }} />
                                    <span>{EDGE_THEME[kind].label}</span>
                                </div>)
                        }
                    </div>
                }
            </div>
        </Panel>

        <Background color="var(--mp-grid-line)" gap={18} />

        {
            hover && hover.node && hover.node.data &&
            <div className="pdx-nodecard" role="tooltip"
                style={{ left: Math.min(hover.x + 16, 9999), top: hover.y + 16 }}>
                <div className="pdx-nodecard__head">
                    <span className="pdx-nodecard__kind">
                        {(NODE_THEME[hover.node.data.kind] || NODE_THEME["section"]).label}
                    </span>
                    <span className="pdx-nodecard__title">{hover.node.data.label}</span>
                </div>
                {
                    Array.isArray(hover.node.data.details) && hover.node.data.details.length > 0 &&
                    <dl className="pdx-nodecard__facts">
                        {
                            hover.node.data.details.map((detail:any, i:number) =>
                                <React.Fragment key={i}>
                                    <dt>{detail.label}</dt>
                                    <dd>{detail.value}</dd>
                                </React.Fragment>)
                        }
                    </dl>
                }
                {
                    (hover.node.data.itemId || hover.node.data.packageRef) &&
                    <div className="pdx-nodecard__hint">
                        { hover.node.data.packageRef ? "clique para abrir este pacote" : "clique para inspecionar" }
                    </div>
                }
            </div>
        }
    </ReactFlow>
}

const RuntimeDiagramView = ({ model, scope = "boot", selectedId, onSelectItem, onOpenRef, emptyHint }:Props) => {

    const graph = useMemo(() => buildRuntimeGraph(model, scope), [model, scope])
    // Painel do Inspector é estreito por natureza; um grafo com dezenas de nós
    // precisa da tela toda para ser lido. Esc sai.
    const [fullscreen, setFullscreen] = useState(false)

    useEffect(() => {
        if(!fullscreen) return
        const onKey = (e:KeyboardEvent) => { if(e.key === "Escape"){ e.stopPropagation(); setFullscreen(false) } }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [fullscreen])

    if(!graph.nodes.length)
        return <EmptyState icon="sitemap" title="Sem topologia para desenhar"
            message={emptyHint || "Esta capacidade não declara nada que possa ser ligado num diagrama."} />

    const canvas = <ReactFlowProvider>
        <Canvas key={`${scope}:${fullscreen}`} graph={graph} selectedId={selectedId}
            onSelectItem={onSelectItem} onOpenRef={onOpenRef}
            fullscreen={fullscreen} onToggleFullscreen={() => setFullscreen(!fullscreen)} />
    </ReactFlowProvider>

    if(fullscreen)
        return <>
            <div className="pdx-diagram-scrim" onClick={() => setFullscreen(false)} aria-hidden="true" />
            <div className="pdx-diagram pdx-diagram--full app-grid-bg" role="dialog" aria-modal="true"
                aria-label="Diagrama em tela cheia">
                {canvas}
            </div>
        </>

    return <div className="pdx-diagram app-grid-bg" style={{height:"calc(100vh - var(--pd-header-h) - 250px)", minHeight:400}}>
        {canvas}
    </div>
}

export default RuntimeDiagramView
