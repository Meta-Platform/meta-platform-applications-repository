import dagre from "dagre"

const nodeWidth = 250
const nodeHeight = 20


const GetLayoutedElements = (nodes, edges, direction) => {
    
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    
    const isHorizontal = direction === "LR"
    dagreGraph.setGraph({ rankdir: direction })

    
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
    })

    
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    // Ajusta a posição de cada nó no gráfico React Flow para corresponder ao layout Dagre.
    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        node.targetPosition = isHorizontal ? "left" : "top"
        node.sourcePosition = isHorizontal ? "right" : "bottom"

        // Ajusta a posição do nó de centro para canto superior esquerdo.
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        }

        return node
    })

    return { nodes, edges }
}

// Exporta a função para uso em outros componentes.
export default GetLayoutedElements
