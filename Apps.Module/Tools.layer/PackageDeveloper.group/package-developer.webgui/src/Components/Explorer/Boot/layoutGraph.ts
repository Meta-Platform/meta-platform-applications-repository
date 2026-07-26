import dagre from "dagre"
import { MarkerType } from "reactflow"

import { GraphNode, RuntimeGraph } from "../../../Domain/runtimeGraph"
import { EDGE_THEME } from "./diagramTheme"

// Converte o grafo do domínio em nós/arestas do reactflow, com posições
// calculadas pelo Dagre (mesmo motor dos diagramas do Ecosystem Control Panel).

const NODE_W = 230
const NODE_H = 72

export const layoutGraph = (graph:RuntimeGraph, direction:"LR" | "TB" = "LR") => {

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: direction, ranksep: 90, nodesep: 26, edgesep: 18, marginx: 32, marginy: 32 })

    graph.nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
    graph.edges.forEach((e) => g.setEdge(e.source, e.target))
    dagre.layout(g)

    const horizontal = direction === "LR"

    const nodes = graph.nodes.map((node:GraphNode) => {
        const p = g.node(node.id)
        return {
            id: node.id,
            type: "boot",
            position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
            targetPosition: horizontal ? "left" : "top",
            sourcePosition: horizontal ? "right" : "bottom",
            data: {
                label    : node.label,
                sublabel : node.sublabel,
                kind     : node.kind,
                itemId   : node.itemId,
                sectionId: node.sectionId
            }
        }
    })

    const edges = graph.edges.map((edge) => {
        const theme = EDGE_THEME[edge.kind]
        return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: "smoothstep",
            data: { kind: edge.kind },
            animated: theme.animated,
            markerEnd: { type: MarkerType.ArrowClosed, color: theme.color, width: 16, height: 16 },
            style: {
                stroke: theme.color,
                strokeWidth: 1.5,
                ...(theme.dashed ? { strokeDasharray: "6 4" } : {})
            }
        }
    })

    return { nodes, edges }
}

export default layoutGraph
