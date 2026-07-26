import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import ReactFlow, {
    Background, ConnectionLineType, Controls, MiniMap, Panel, ReactFlowProvider,
    useEdgesState, useNodesInitialized, useNodesState, useReactFlow
} from "reactflow"
import "reactflow/dist/style.css"

import { BootGraph, buildBootGraph, collectNodeKinds } from "../../../Domain/bootGraph"
import { PackageModel } from "../../../Domain/packageModel"
import { EDGE_THEME, NODE_THEME } from "./diagramTheme"
import BootFlowNode from "./BootFlowNode"
import layoutGraph from "./layoutGraph"
import { EmptyState, IconButton, Segmented } from "../ui/Primitives"

// Diagrama da topologia do boot. Interativo de verdade: zoom, pan, ajustar à
// tela, centralizar a seleção, minimapa, legenda e destaque da vizinhança do nó
// selecionado. Clicar num nó seleciona o recurso no Inspector.

const nodeTypes = { boot: BootFlowNode }

// "Ajustar à tela" faz o que promete: cabe tudo. Já a ABERTURA prioriza leitura —
// enquadra e, se o grafo for grande demais para ficar legível, sobe o zoom até o
// mínimo confortável e deixa o usuário navegar (pan/minimapa).
const FIT_OPTIONS = { padding: 0.15, maxZoom: 1, duration: 200 }
const MIN_READABLE_ZOOM = 0.5

type Props = {
    model        : PackageModel
    selectedId?  : string          // id do item do modelo atualmente selecionado
    onSelectItem : (itemId:string) => void
}

const Canvas = ({ graph, selectedId, onSelectItem }:{ graph:BootGraph, selectedId?:string, onSelectItem:(id:string) => void }) => {

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

    const onNodeClick = useCallback((_e:any, node:any) => {
        if(node && node.data && node.data.itemId) onSelectItem(node.data.itemId)
    }, [onSelectItem])

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
                <IconButton icon="expand" label="Ajustar à tela" text="Ajustar" onClick={() => fitView(FIT_OPTIONS)} />
                <IconButton icon="crosshairs" label="Centralizar seleção" text="Centralizar" onClick={centerSelection} disabled={!selectedNodeId} />
                <Segmented ariaLabel="Direção do layout" value={direction} onChange={setDirection}
                    options={[{ value: "LR", label: "horizontal" }, { value: "TB", label: "vertical" }]} />
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
    </ReactFlow>
}

const BootDiagramView = ({ model, selectedId, onSelectItem }:Props) => {

    const graph = useMemo(() => buildBootGraph(model), [model])

    if(!graph.nodes.length)
        return <EmptyState icon="sitemap" title="Sem topologia para desenhar"
            hint="Este pacote não declara serviços, executáveis, endpoints ou comandos." />

    return <div className="pdx-diagram app-grid-bg" style={{height:"calc(100vh - var(--pd-header-h) - 210px)", minHeight:420}}>
        <ReactFlowProvider>
            <Canvas graph={graph} selectedId={selectedId} onSelectItem={onSelectItem} />
        </ReactFlowProvider>
    </div>
}

export default BootDiagramView
