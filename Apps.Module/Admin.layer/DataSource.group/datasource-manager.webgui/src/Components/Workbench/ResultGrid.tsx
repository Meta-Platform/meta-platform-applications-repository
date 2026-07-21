import * as React from "react"

type ResultGridProps = {
    columns : string[]
    rows    : any[]
    pkColumns ?: string[]
    onSort  ?: (col:string) => void
    orderBy ?: string
    orderDir?: string
}

const renderCell = (value:any) => {
    if(value === null || value === undefined)
        return <span className="ds-null">NULL</span>
    if(typeof value === "object")
        return JSON.stringify(value)
    return String(value)
}

// Grade genérica só-leitura (usada pelo console SQL e como base). A grade
// editável de dados é o DataGridPanel.
const ResultGrid = ({columns, rows, pkColumns=[], onSort, orderBy, orderDir}:ResultGridProps) =>
    <div className="ds-grid__scroll">
        <table className="ds-grid">
            <thead>
                <tr>
                    {columns.map((col) =>
                        <th key={col}
                            className={pkColumns.includes(col) ? "pk" : ""}
                            onClick={() => onSort && onSort(col)}>
                            {col}
                            {orderBy === col && <span className="ds-sortdir">{orderDir === "DESC" ? "▼" : "▲"}</span>}
                        </th>)}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) =>
                    <tr key={i}>
                        {columns.map((col) => <td key={col}>{renderCell(row[col])}</td>)}
                    </tr>)}
            </tbody>
        </table>
    </div>

export default ResultGrid
