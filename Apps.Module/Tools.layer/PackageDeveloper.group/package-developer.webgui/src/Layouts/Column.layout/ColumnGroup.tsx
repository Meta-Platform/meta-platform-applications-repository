import React from "react"


type ColumnGroupProps = {
    columns:any
    children:any
}

// `columns` mantém o contrato do antigo <Grid columns={...}>: um número fixo de
// colunas ou "equal" (colunas de mesma largura, quantidade dada pelos filhos).
const TemplateOf = (columns:any) =>
    typeof columns === "number"
        ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
        : { gridAutoFlow: "column" as const, gridAutoColumns: "minmax(0, 1fr)" }

const ColumnGroup = ({columns, children}:ColumnGroupProps) =>
    <div className="pdx-column-group">
        <div className="pdx-column-group__row" style={TemplateOf(columns)}>
            {children}
        </div>
    </div>

export default ColumnGroup
