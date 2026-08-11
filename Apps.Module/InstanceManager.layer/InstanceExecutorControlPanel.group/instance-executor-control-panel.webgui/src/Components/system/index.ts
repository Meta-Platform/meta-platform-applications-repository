// Componentes de painel de sistema do Instance Executor.
//
// Aqui ficam SÓ as primitivas de monitor que o kit comum (@i-components) ainda
// não tem: grid denso redimensionável, traço mínimo de série (sparkline) e os
// selos de domínio da execução (tipo, versão, origem, medidor). A série
// temporal e o visor de log foram promovidos ao kit; o que resta do log aqui é
// o container que assina o stream do daemon.
// Tudo o que é genérico — botão, busca, cartão, contador, estado, vazio,
// tabela, shell — vem do kit.
export { default as DataGrid } from "./DataGrid"
export { default as Sparkline } from "./Sparkline"
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
