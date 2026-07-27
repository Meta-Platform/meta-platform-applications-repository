// Componentes de painel de sistema do Instance Executor.
//
// São primitivas de monitor (grid denso, medidor, série temporal, visualizador
// de log) construídas sobre os tokens --mp-* do design system — não dependem de
// nada específico deste painel e podem ser levadas para os outros.
export { default as DataGrid } from "./DataGrid"
export { default as TimeSeriesChart, Sparkline } from "./TimeSeriesChart"
export { default as LogViewer } from "./LogViewer"

export {
    StatusDot,
    StateLabel,
    GetStateFamily,
    KindTag,
    KindIcon,
    Meter,
    KeyValueList,
    Card,
    StatCard,
    EmptyState,
    Tabs,
    SearchField
} from "./Indicators"

export {
    FormatBytes,
    FormatPercent,
    FormatDuration,
    FormatClock,
    FormatDateTime,
    PackageName,
    SecondsSince
} from "./Format"

export type { GridColumn } from "./DataGrid"
export type { ChartSeries, ChartPoint } from "./TimeSeriesChart"
