# Instance Executor Control Panel (Desktop)

Versão **desktop** (Electron) do Instance Executor Control Panel: painel para
monitorar o executor de tarefas de uma instância, explorar pacotes/repositórios e
disparar execução de pacotes.

É um package do tipo [`.desktopapp`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/package.md)
em **modo GUI-host** (ver `desktop-window-instance.lib`): o processo principal do
Electron **compila o `instance-executor-control-panel.webgui` e hospeda os services
no próprio processo**, expostos ao renderer por **IPC** (`window.metaGui`) — **sem
webservices HTTP**, sem porta TCP. Mantém *dual-transport*: no navegador o mesmo
webgui segue via HTTP (`instance-executor-control-panel.webapp`).

## Grafo de services (`gui-host.serviceGraph`)

Reconstrói, dentro do Electron, o mesmo grafo da webservice:

1. `repositoryManager` — `@/repository-manager.service`
2. `standardTaskExecutorMachine` — `@/task-executor-machine.service`
3. `environmentRuntime` — `@/environment-runtime-manager.service` (usa `taskExecutorMachine`)
4. `ecosystemManager` — `@/ecosystem-manager.service` (usa `repositoryManager` + `environmentRuntime`)
5. `guiService` — `@/instance-executor-control-panel-gui.service` (compõe os 3
   controllers da webservice: TaskExecutorMonitor / RepositoryManager /
   EcosystemManager)

## Streaming (WebSocket via IPC)

O painel tem endpoints WebSocket (TaskExecutorMonitor: `MonitoringState`/`TaskList`;
EcosystemManager: `PackageList`). O `guiService` expõe `InvokeStream`, e o renderer
usa `Utils/IPCWebSocket` (API compatível com a do WebSocket do browser) sobre
`window.metaGui.stream` — os hooks/consumidores de socket não mudam.

Ícones de pacote são servidos pelo protocolo `metaicon://` (via `guiService.GetIcon`).

> **Nota (`installDataDirPath`):** use caminho **absoluto** (ex.
> `/home/<user>/EcosystemData`) no `startup-params.json`. O `EcosystemManager` do
> core consome `ECO_DIRPATH_INSTALL_DATA` **sem expandir `~`** (`join`/`resolve`
> diretos), diferente do `RepositoryManagerService`; um `~/EcosystemData` seria
> resolvido relativo ao cwd do processo Electron e quebraria a escrita de
> `repositories.json`.
