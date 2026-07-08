# instance-manager-runtime.service

- **Tipo:** serviço (`.service`)
- **Namespace:** `@/instance-manager-runtime.service`
- **Localização:** `InstanceExecutorControlPanel.group/instance-manager-runtime.service`

## Propósito

Serviço-proxy do painel `instance-executor-control-panel` para a
execução/monitoração de pacotes e tarefas. O painel é o gerenciador de
processos do ecossistema, mas **não executa nada por si**: delega ao daemon
`executor-manager` através de `@/instance-manager-client.lib`.

Cria o cliente do daemon uma vez e reexpõe a superfície aos controllers
`EcosystemManager` (pacotes/processos) e `TaskExecutorMonitor` (tarefas):

| Método | Uso |
|--------|-----|
| `IsAvailable()` | daemon de pé? |
| `RunPackage` / `StopPackage` / `ListPackages` / `OpenPackageListStream` | pacotes supervisionados |
| `ListTasks` / `GetTask` / `OpenTaskStatusStream` / `StopTasks` | tarefas do task-executor do daemon |

## Dependências

- `@/instance-manager-client.lib` (bound-param `instanceManagerClientLib`).

## Parâmetros

- `platformApplicationSocketPath` — socket do daemon `executor-manager`.

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md).
