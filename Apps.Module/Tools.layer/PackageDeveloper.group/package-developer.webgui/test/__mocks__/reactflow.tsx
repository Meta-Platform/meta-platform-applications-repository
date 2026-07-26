import * as React from "react"

// Stub do reactflow para o ambiente de teste: o pacote é ESM + CSS e não roda no
// jsdom. O que interessa testar (montagem do grafo, tipos de nó, arestas) vive em
// Domain/bootGraph e Boot/layoutGraph, cobertos por testes próprios. Aqui só
// garantimos que a view renderiza nós clicáveis.

export const MarkerType = { ArrowClosed: "arrowclosed" }
export const Position = { Left: "left", Right: "right", Top: "top", Bottom: "bottom" }
export const ConnectionLineType = { SmoothStep: "smoothstep" }

export const Handle = () => null
export const Background = () => null
export const Controls = () => null
export const MiniMap = () => null
export const Panel = ({ children }:any) => <div>{children}</div>
export const ReactFlowProvider = ({ children }:any) => <div>{children}</div>

export const useNodesState = (initial:any) => {
    const [nodes, setNodes] = React.useState(initial)
    return [nodes, setNodes, () => {}]
}
export const useEdgesState = (initial:any) => {
    const [edges, setEdges] = React.useState(initial)
    return [edges, setEdges, () => {}]
}
export const useReactFlow = () => ({
    fitView: () => {},
    setCenter: () => {},
    getNode: () => undefined,
    getZoom: () => 1,
    zoomTo: () => {}
})
export const useNodesInitialized = () => true

const ReactFlow = ({ nodes, nodeTypes, onNodeClick, children }:any) => {
    const NodeComponent = nodeTypes && nodeTypes.boot
    return <div data-testid="react-flow">
        {
            (nodes || []).map((node:any) =>
                <div key={node.id} data-testid={`node-${node.id}`} onClick={(e:any) => onNodeClick && onNodeClick(e, node)}>
                    { NodeComponent ? <NodeComponent data={node.data} /> : node.data.label }
                </div>)
        }
        {children}
    </div>
}

export default ReactFlow
