import React, { useCallback, useEffect } from "react"
import ReactFlow, {
	addEdge,
	ConnectionLineType,
	useNodesState,
	useEdgesState,
	Background,
	Controls,
} from "reactflow"

import styled from "styled-components"
import "reactflow/dist/style.css"

import ConvertDependencyToFlowElements from "./ConvertDependencyToFlowElements"
import GetLayoutedElements from "./GetLayoutedElements"

const DivFlowContainerStyled = styled.div`
    width: 100%;
    height: 320px;
    overflow: hidden;
    border: 1px solid #eee;
`

const DependencyDiagram = ({ dependencyHierarchy }) => {

	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	useEffect(() => {
		if(dependencyHierarchy){
			const { nodes: initialNodes, edges: initialEdges } = ConvertDependencyToFlowElements(dependencyHierarchy)
			const { nodes, edges } = GetLayoutedElements(initialNodes, initialEdges, "LR")
			setNodes(nodes)
			setEdges(edges)
		}

	}, [dependencyHierarchy])

	const onConnect = useCallback(
		(params) =>
			setEdges((eds) =>
				addEdge(
					{ 
						...params
					},
					eds
				)
			),
		[]
	)

	return (
		<DivFlowContainerStyled className="react-flow-container">
			<div style={{ width: "100%", height: "100%" }}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					connectionLineType={ConnectionLineType.SmoothStep}
					fitView>
					<Controls position="top-left" />
					<Background color="#aaa" gap={16} />
				</ReactFlow>
			</div>
		</DivFlowContainerStyled>
	)
}

export default DependencyDiagram