// Componentes de painel de sistema do Instance Executor.
//
// Aqui ficam SÓ as primitivas de monitor que o kit comum (@i-components) ainda
// não tem: grid denso redimensionável, série temporal, visualizador de log ao
// vivo e os selos de domínio da execução (tipo, versão, origem, medidor).
// Tudo o que é genérico — botão, busca, cartão, contador, estado, vazio,
// tabela, shell — vem do kit.
export { default as DataGrid } from "./DataGrid"
export { default as TimeSeriesChart, Sparkline } from "./TimeSeriesChart"
export { default as LogViewer } from "./LogViewer"

export {
    KindTag,
    KindIcon,
    VersionTag,
    OriginTag,
    Meter
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
