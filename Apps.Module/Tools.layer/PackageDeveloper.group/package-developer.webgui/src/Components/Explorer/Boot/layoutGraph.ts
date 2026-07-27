import dagre from "dagre"
import { MarkerType } from "reactflow"

import { GraphNode, RuntimeGraph } from "../../../Domain/runtimeGraph"
import { EDGE_THEME, NODE_SHAPE } from "./diagramTheme"

// Converte o grafo do domínio em nós/arestas do reactflow, com posições
// calculadas pelo Dagre (mesmo motor dos diagramas do Ecosystem Control Panel).

const DEFAULT_W = 230
const DEFAULT_H = 76

// Cada tipo tem tamanho próprio (ver NODE_SHAPE) — o Dagre precisa saber disso
// para não deixar cartão grande colado em pílula pequena.
const sizeOf = (node:GraphNode) => NODE_SHAPE[node.kind] || { width: DEFAULT_W, height: DEFAULT_H }

export const layoutGraph = (graph:RuntimeGraph, direction:"LR" | "TB" = "LR") => {

    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({
        rankdir: direction,
        align: "UL",          // alinha as colunas: menos serrilhado entre níveis
        ranksep: 110,
        nodesep: 34,
        edgesep: 20,
        marginx: 40,
        marginy: 40
    })

    graph.nodes.forEach((n) => {
        const { width, height } = sizeOf(n)
        g.setNode(n.id, { width, height })
    })
    graph.edges.forEach((e) => g.setEdge(e.source, e.target))
    dagre.layout(g)

    const horizontal = direction === "LR"

    const nodes = graph.nodes.map((node:GraphNode) => {
        const p = g.node(node.id)
        const { width, height } = sizeOf(node)
        return {
            id: node.id,
            type: "boot",
            position: { x: p.x - width / 2, y: p.y - height / 2 },
            targetPosition: horizontal ? "left" : "top",
            sourcePosition: horizontal ? "right" : "bottom",
            data: {
                label     : node.label,
                sublabel  : node.sublabel,
                kind      : node.kind,
                itemId    : node.itemId,
                sectionId : node.sectionId,
                details   : node.details,
                packageRef: node.packageRef
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
