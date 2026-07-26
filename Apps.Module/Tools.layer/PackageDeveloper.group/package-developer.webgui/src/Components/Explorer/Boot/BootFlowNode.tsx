import * as React from "react"
import { Handle, Position } from "reactflow"

import { NODE_THEME } from "./diagramTheme"

// Nó do diagrama: rótulo do TIPO (texto, não só cor) + nome completo com quebra
// controlada — nada de nome truncado com reticências, que era a principal queixa
// do diagrama antigo. O título nativo mostra o valor inteiro no hover.

const BootFlowNode = ({ data, selected }:any) => {
    const theme = NODE_THEME[data.kind] || NODE_THEME["section"]
    const handleStyle = { background: theme.accent, width: 7, height: 7, border: "none" }
    return <div
        className={`pdx-node pdx-node--${data.kind}${selected || data.highlighted ? " pdx-node--selected" : ""}`}
        style={{ borderColor: theme.accent, opacity: data.dimmed ? 0.25 : 1 }}
        title={data.sublabel ? `${data.label}\n${data.sublabel}` : data.label}>
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <span className="pdx-node__kind" style={{ borderColor: theme.accent }}>{theme.label}</span>
        <div className="pdx-node__label">{data.label}</div>
        { data.sublabel && <div className="pdx-node__sub">{data.sublabel}</div> }
        <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
}

export default React.memo(BootFlowNode)
