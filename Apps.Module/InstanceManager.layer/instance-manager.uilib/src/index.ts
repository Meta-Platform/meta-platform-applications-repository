// Biblioteca de ÁREA do Instance Manager (Launcher + Instance Executor Control
// Panel). Só entra aqui o que é específico da área; primitivas, cabeçalhos,
// status e shell vivem no kit comum @i-components.
export { default as CommandGroupForm } from "./components/CommandGroupForm"
export { default as ParamsViewer } from "./components/ParamsViewer"
export { instanceManagerStories } from "./catalog/stories"
export { default as useWebSocket } from "./hooks/useWebSocket"
export * from "./utils/CommandGroup"

// CopyableMonoText, EntityHeader, PageMasthead, StatusBadge, StatusStrip,
// StatusChip, SystemBanner, GetStatusMeta e GetSeverityRank foram PROMOVIDOS
// para o kit comum e já não são re-exportados daqui: importe-os de
// "@i-components". Os dois consumidores da área (launcher.webgui e
// instance-executor-control-panel.webgui) já apontam para lá.
