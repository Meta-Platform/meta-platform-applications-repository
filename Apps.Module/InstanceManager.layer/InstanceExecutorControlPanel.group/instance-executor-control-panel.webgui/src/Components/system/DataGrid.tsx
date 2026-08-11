import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Icon } from "@i-components"

/**
 * Grid denso de dados, no espírito da lista de processos de um monitor de
 * sistema (Gerenciador de Tarefas / GNOME System Monitor / htop).
 *
 * NÃO é o `DataTable` do kit, e a diferença é funcional, não estética: aqui a
 * coluna é redimensionável arrastando a divisória, a ordenação é por clique no
 * cabeçalho, a linha aceita recuo de árvore e o cabeçalho fica fixo na
 * rolagem. Numa lista de processos essas quatro coisas são a ferramenta. O
 * `DataTable` do kit é usado onde a tabela é só leitura (ver OverviewView).
 *
 * O que muda em relação a uma `<table>`:
 * - CSS grid com largura POR COLUNA, redimensionável arrastando a divisória;
 * - uma coluna elástica (`flex`) que absorve a sobra, em vez de todas
 *   encolherem juntas;
 * - truncamento sempre com `title`, para o valor inteiro continuar acessível;
 * - ordenação por qualquer coluna e cabeçalho fixo na rolagem.
 */

export type GridColumn = {
    key: string
    label: string
    width?: number                       // largura inicial em px
    minWidth?: number
    flex?: boolean                       // absorve o espaço que sobra
    align?: "left" | "right"
    mono?: boolean
    sortable?: boolean
    render?: (row: any) => React.ReactNode
    value?: (row: any) => any            // valor usado na ordenação/tooltip
    title?: (row: any) => string
    indent?: (row: any) => number        // recuo em níveis, para árvore
}

type SortState = { column: string, direction: "asc" | "desc" }

const DEFAULT_WIDTH = 120
const DEFAULT_MIN_WIDTH = 56

const _SortValue = (row: any, column: GridColumn) => {
    const value = column.value ? column.value(row) : row[column.key]
    return typeof value === "string" ? value.toLowerCase() : value
}

const DataGrid = ({
    columns = [],
    rows = [],
    rowKey = (row: any) => row.id,
    selectedKey,
    onSelectRow,
    onActivateRow,
    defaultSort,
    sortable = true,
    rowClassName,
    emptyTitle = "nada para mostrar",
    emptyHint
}: any) => {

    const [ widths, setWidths ] = useState<any>({})
    const [ sort, setSort ]     = useState<SortState | undefined>(defaultSort)

    const resizeRef = useRef<any>(null)
    const [ resizingKey, setResizingKey ] = useState<string>()

    // Largura efetiva de uma coluna: o que o usuário arrastou, senão o padrão
    // declarado pela coluna.
    const _Width = (column: GridColumn) => widths[column.key] ?? column.width ?? DEFAULT_WIDTH

    const template = useMemo(
        () => columns
            .map((column: GridColumn) => column.flex
                ? `minmax(${column.minWidth || 140}px, 1fr)`
                : `${_Width(column)}px`)
            .join(" "),
        [columns, widths])

    // Arrasto da divisória. Os listeners vivem no documento porque o ponteiro
    // sai do elemento durante o arrasto — preso ao elemento, o redimensionamento
    // travaria assim que o cursor passasse da borda.
    const _StartResize = useCallback((event: any, column: GridColumn) => {
        event.preventDefault()
        event.stopPropagation()
        resizeRef.current = {
            key: column.key,
            startX: event.clientX,
            startWidth: _Width(column),
            minWidth: column.minWidth || DEFAULT_MIN_WIDTH
        }
        setResizingKey(column.key)
    }, [widths, columns])

    useEffect(() => {
        if (!resizingKey) return

        const _onMove = (event: MouseEvent) => {
            const state = resizeRef.current
            if (!state) return
            const next = Math.max(state.minWidth, state.startWidth + (event.clientX - state.startX))
            setWidths((current: any) => ({ ...current, [state.key]: next }))
        }
        const _onUp = () => { resizeRef.current = null; setResizingKey(undefined) }

        document.addEventListener("mousemove", _onMove)
        document.addEventListener("mouseup", _onUp)
        return () => {
            document.removeEventListener("mousemove", _onMove)
            document.removeEventListener("mouseup", _onUp)
        }
    }, [resizingKey])

    const _ToggleSort = (column: GridColumn) => {
        if (!sortable || !column.sortable) return
        setSort((current) => current && current.column === column.key
            ? { column: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
            : { column: column.key, direction: "asc" })
    }

    // A ordem da lista é preservada quando não há ordenação escolhida: para uma
    // árvore de tarefas, a ordem de chegada É a informação (pai antes do filho).
    const visibleRows = useMemo(() => {
        if (!sort) return rows
        const column = columns.find((item: GridColumn) => item.key === sort.column)
        if (!column) return rows

        return [...rows].sort((rowA: any, rowB: any) => {
            const valueA = _SortValue(rowA, column)
            const valueB = _SortValue(rowB, column)
            if (valueA === valueB) return 0
            if (valueA === undefined || valueA === null) return 1
            if (valueB === undefined || valueB === null) return -1
            const comparison = valueA < valueB ? -1 : 1
            return sort.direction === "asc" ? comparison : -comparison
        })
    }, [rows, sort, columns])

    const _CellContent = (row: any, column: GridColumn) => {
        if (column.render) return column.render(row)
        const value = column.value ? column.value(row) : row[column.key]
        return value === undefined || value === null || value === "" ? "—" : value
    }

    const _CellTitle = (row: any, column: GridColumn) => {
        if (column.title) return column.title(row)
        const value = column.value ? column.value(row) : row[column.key]
        return typeof value === "string" || typeof value === "number" ? String(value) : undefined
    }

    return <div className="iep-grid">
        <div className="iep-grid__scroll">
            <div className="iep-grid__row iep-grid__row--head" style={{ gridTemplateColumns: template }}>
                {
                    columns.map((column: GridColumn) => {
                        const isSorted = sort && sort.column === column.key
                        const canSort  = sortable && column.sortable
                        return <div
                            key={column.key}
                            className={[
                                "iep-grid__head-cell",
                                canSort ? "iep-grid__head-cell--sortable" : "",
                                column.align === "right" ? "iep-grid__head-cell--num" : ""
                            ].filter(Boolean).join(" ")}
                            title={column.label}
                            onClick={() => _ToggleSort(column)}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{column.label}</span>
                            {
                                isSorted &&
                                <Icon
                                    className="iep-grid__sort"
                                    name={sort!.direction === "asc" ? "caret up" : "caret down"}/>
                            }
                            {
                                !column.flex &&
                                <span
                                    className={`iep-grid__resizer${resizingKey === column.key ? " iep-grid__resizer--active" : ""}`}
                                    onMouseDown={(event) => _StartResize(event, column)}
                                    onClick={(event) => event.stopPropagation()}/>
                            }
                        </div>
                    })
                }
            </div>

            {
                visibleRows.map((row: any) => {
                    const key = rowKey(row)
                    const extra = rowClassName ? rowClassName(row) : ""
                    return <div
                        key={key}
                        className={[
                            "iep-grid__row",
                            "iep-grid__row--body",
                            key === selectedKey ? "iep-grid__row--selected" : "",
                            extra
                        ].filter(Boolean).join(" ")}
                        style={{ gridTemplateColumns: template }}
                        onClick={() => onSelectRow && onSelectRow(row)}
                        onDoubleClick={() => onActivateRow && onActivateRow(row)}>
                        {
                            columns.map((column: GridColumn) => <div
                                key={column.key}
                                className={[
                                    "iep-grid__cell",
                                    column.align === "right" ? "iep-grid__cell--num" : "",
                                    column.mono && column.align !== "right" ? "iep-grid__cell--mono" : ""
                                ].filter(Boolean).join(" ")}
                                style={column.indent ? { paddingLeft: `${column.indent(row) * 16}px` } : undefined}
                                title={_CellTitle(row, column)}>
                                {_CellContent(row, column)}
                            </div>)
                        }
                    </div>
                })
            }

            {
                visibleRows.length === 0 &&
                <div className="iep-grid__empty">
                    <div>{emptyTitle}</div>
                    {emptyHint && <div className="iep-grid__empty-hint">{emptyHint}</div>}
                </div>
            }
        </div>
    </div>
}

export default DataGrid
