
import { MarkerType } from 'reactflow'

const ConvertDependencyListToNodes = (dependencyList) => 
    dependencyList
        .reduce((nodesAcc, { code, dependency }) => {

            const {
                metadata
            } = dependency

            const nodeId = code
            const nodeLabel = metadata.package.namespace

            nodesAcc.set(nodeId, {
                id: nodeId,
                data: { label: nodeLabel },
                style: {
                    width: 250
                }
            })

            return nodesAcc
        }, new Map())


const ConvertLinkedGraphToEdges = (linkedGraph) => {

    const edges = new Set()

    const hasChildren = 
        graph => code => Object.keys(graph[code]).length > 0


    const getEdge = (source, target) => {
        const edgeId = `e${source}-${target}`

        return {
            edgeId,
            //type: 'smoothstep',
            markerEnd: {
                type: MarkerType.ArrowClosed,
            },
            source,
            target
        }
    }

    const _MountEdges = (graph, edges) => {
        const nodeCodes = Object.keys(graph || {})

        return nodeCodes
            .filter(hasChildren(graph))
            .reduce((edgesAcc, code) => {
                const childGraph = graph[code]
                const childNodeCodes = Object.keys(childGraph)

                childNodeCodes
                .forEach((childCode) => {
                    edges.add(getEdge(code, childCode))
                })
                
                _MountEdges(childGraph, edges)

                return edgesAcc
            }, edges)
    }
    
    _MountEdges(linkedGraph, edges)
    return edges
}

const ConvertDependencyToFlowElements = (dependencyHierarchy) => {

    const {
        dependencyList,
        packageDependencyGraph
    } = dependencyHierarchy

    const nodes = ConvertDependencyListToNodes(dependencyList)
    const edges = ConvertLinkedGraphToEdges(packageDependencyGraph)

    return { 
        nodes: Array.from(nodes.values()), 
        edges: Array.from(edges)
    }
}

export default ConvertDependencyToFlowElements
