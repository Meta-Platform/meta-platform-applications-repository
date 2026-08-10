import * as React from "react"

import { DataTable, DataColumn } from "@i-components"

type ResultGridProps = {
    columns : string[]
    rows    : any[]
    pkColumns ?: string[]
}

// Mesmo corte da grade de dados: um valor pode ser um texto imenso, e sem a
// elipse uma linha só toma a tela inteira.
const renderCell = (value:any) => {
    if(value === null || value === undefined)
        return <span className="ds-cell ds-null">NULL</span>
    return <span className="ds-cell" title={typeof value === "object" ? undefined : String(value)}>
        { typeof value === "object" ? JSON.stringify(value) : String(value) }
    </span>
}

// Grade genérica só-leitura (usada pelo console SQL). A grade editável de dados
// é o DataGridPanel. As colunas viram DADO para a `DataTable` do kit — a tabela
// deixou de ser <table> local com CSS próprio.
const ResultGrid = ({columns, rows, pkColumns = []}:ResultGridProps) => {

    const tableColumns:DataColumn[] = columns.map((col) => ({
        key    : col,
        header : pkColumns.indexOf(col) >= 0 ? `${col} · PK` : col,
        mono   : true,
        render : (row:any) => renderCell(row[col])
    }))

    return <DataTable
        className    = "ds-grid"
        dense        = {true}
        columns      = {tableColumns}
        rows         = {rows}
        rowKey       = {(_row:any, index:number) => String(index)}
        emptyMessage = "sem linhas"/>
}

export default ResultGrid
