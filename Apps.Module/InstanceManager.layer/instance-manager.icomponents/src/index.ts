// Biblioteca de ÁREA do Instance Manager (Launcher + Instance Executor Control
// Panel). Só entra aqui o que é específico da área; primitivas, cabeçalhos,
// status e shell vivem no kit comum @i-components.
export { default as CommandGroupForm } from "./components/CommandGroupForm"
export { default as ParamsViewer } from "./components/ParamsViewer"
export { instanceManagerStories } from "./catalog/stories"
export { default as useWebSocket } from "./hooks/useWebSocket"
export * from "./utils/CommandGroup"

// Compatibilidade: estes componentes foram PROMOVIDOS para o kit comum (o CSS
// deles já vivia lá). Importe de "@i-components" — estes re-exports saem quando
// o Instance Executor Control Panel migrar (onda 2).
export {
    CopyableMonoText,
    EntityHeader,
    PageMasthead,
    StatusBadge,
    StatusStrip,
    StatusChip,
    SystemBanner,
    GetStatusMeta,
    GetSeverityRank
} from "@i-components"
