# launcher.desktopapp

- **Tipo:** aplicação desktop Electron (`.desktopapp`)
- **Namespace:** `@/launcher.desktopapp`
- **Executável:** `launcher-desktop`
- **Localização:** `Apps.Module/InstanceManager.layer/Launcher.group/launcher.desktopapp` (PlatformApplicationsRepo)

## Propósito

Versão **desktop** (Electron) do **Launcher**: navegar pelos repositórios
instalados, inspecionar um pacote e executá-lo, com terminal para pacotes
`.cli`.

Roda em **modo GUI-host**: o processo principal do Electron compila o
`launcher.webgui` e **hospeda os services no próprio processo**, expostos ao
renderer por **IPC** (`window.metaGui`) — sem webservice HTTP e sem porta TCP.
O modo é *dual-transport*: o mesmo webgui continua servido por HTTP quando quem
sobe é o `launcher.webapp`.

## Execução

Executado pelo Package Executor a partir do executável `launcher-desktop`.

## Janelas (`metadata/boot.json` → `windows`)

| Título | Dimensões | Dependência | GUI-host |
|---|---|---|---|
| Launcher | 1280x800 | `@/launcher.webgui` | sim |

## Grafo de services (`gui-host.serviceGraph`)

Reconstrói dentro do Electron o mesmo grafo que a webservice monta por HTTP:

| Ref | Pacote | Factory |
|---|---|---|
| `repositoryManager` | `@/repository-manager.service` | `Services/RepositoryManager.service` |
| `commandLineRuntime` | `@/command-line-runtime.service` | `Services/CommandLineRuntime.service` |
| `instanceManagerRuntime` | `@/instance-manager-runtime.service` | `Services/InstanceManagerRuntime.service` |
| `guiService` | `@/launcher-gui.service` | `Services/LauncherGui.service` |

## Streaming (WebSocket via IPC)

Os endpoints WebSocket do Launcher (`EcosystemManager.PackageList`,
`CommandLineRuntime.TerminalStream`) chegam ao renderer pelo `InvokeStream` do
`guiService`, através de um shim com a mesma API do WebSocket do navegador — os
consumidores de socket não mudam entre desktop e web.

Ícones de pacote são servidos pelo protocolo `metaicon://`.

> **Nota (`installDataDirPath`):** use caminho **absoluto** (ex. `/home/<user>/EcosystemData`) no `startup-params.json`. O `EcosystemManager` do core consome `ECO_DIRPATH_INSTALL_DATA` **sem expandir `~`**, diferente do `RepositoryManagerService`; um `~/EcosystemData` seria resolvido relativo ao cwd do processo Electron e quebraria a escrita de `repositories.json`.
