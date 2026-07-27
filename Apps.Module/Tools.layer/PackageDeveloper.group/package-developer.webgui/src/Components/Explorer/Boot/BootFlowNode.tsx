import * as React from "react"
import { Handle, Position } from "reactflow"
import { Icon } from "semantic-ui-react"

import { NODE_SHAPE, NODE_THEME } from "./diagramTheme"

// Nó do diagrama. A FORMA e o TAMANHO mudam com o tipo — parâmetro é uma pílula
// pequena, serviço é um cartão, pacote provedor é um cartão com ícone de caixa —
// para dar leitura periférica sem depender de cor nem de ler o rótulo. O tipo
// também vem escrito, e o nome nunca é truncado destrutivamente.

const BootFlowNode = ({ data, selected }:any) => {
    const theme = NODE_THEME[data.kind] || NODE_THEME["section"]
    const shape = NODE_SHAPE[data.kind] || NODE_SHAPE["section"]
    const handleStyle = { background: theme.accent, width: 7, height: 7, border: "none" }

    return <div
        className={`pdx-node pdx-node--${shape.variant} pdx-node--kind-${data.kind}${selected || data.highlighted ? " pdx-node--selected" : ""}`}
        style={{ borderColor: theme.accent, opacity: data.dimmed ? 0.22 : 1, width: shape.width }}
        data-clickable={data.itemId || data.packageRef ? "true" : undefined}
        // title nativo além da ficha do hover: serve a quem navega sem mouse e
        // garante o valor completo mesmo com o rótulo em duas linhas.
        title={data.sublabel ? `${data.label}\n${data.sublabel}` : data.label}>
        <Handle type="target" position={Position.Left} style={handleStyle} />

        <div className="pdx-node__top">
            { shape.icon && <Icon name={shape.icon as any} style={{margin:0, color: theme.accent}} /> }
            <span className="pdx-node__kind" style={{ borderColor: theme.accent, color: theme.accent }}>
                {theme.label}
            </span>
            { data.packageRef && <Icon name="external" style={{margin:"0 0 0 auto", opacity:.55}} /> }
        </div>

        <div className="pdx-node__label">{data.label}</div>
        { data.sublabel && <div className="pdx-node__sub">{data.sublabel}</div> }

        <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
}

export default React.memo(BootFlowNode)
