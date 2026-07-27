# instance-manager-runtime.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/instance-manager-runtime.service`
- **Localização:** `Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-manager-runtime.service` (PlatformApplicationsRepo)

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
| `ReadInstanceLog` / `OpenInstanceLogStream` / `ListInstanceLogs` | log gravado pelo daemon para cada instância |
| `ListInstanceMetrics` / `GetInstanceMetrics` / `OpenMetricsStream` | amostras de desempenho coletadas pelo daemon |

## Dependências

- `@/instance-manager-client.lib` (bound-param `instanceManagerClientLib`).

## Parâmetros

- `platformApplicationSocketPath` — socket do daemon `executor-manager`.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (bound-params) |
|---|---|---|
| `InstanceManagerRuntimeService` | `Services/InstanceManagerRuntime.service` | `instanceManagerClientLib` |

> Consulte a [Arquitetura](https://github.com/Meta-Platform/.github/blob/main/docs/ARQUITETURA.md).
