# instance-executor-control-panel.webservice

- **Tipo:** serviço web, backend HTTP (`.webservice`)
- **Namespace:** `@/instance-executor-control-panel.webservice`
- **Localização:** `Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webservice` (PlatformApplicationsRepo)

## Propósito

Web service (backend) do **Instance Executor Control Panel** (executável
`executor-panel`). Expõe as APIs REST/controllers que o
`instance-executor-control-panel.webgui` consome para acompanhar o executor de
instâncias.

## Execução

Não é executado de forma independente (`node index.js`). É montado em runtime
sobre um `@@/server-service` a partir do seu
[`metadata/endpoint-group.json`](./metadata/endpoint-group.json), quando o
`instance-executor-control-panel.webapp` é executado pelo Package Executor.
Depende, via `bound-params`, de `serverService`, `taskExecutorMachineService`,
`repositoryManagerService` e `ecosystemManagerService`.

## Serviços disponibilizados

| URL | Controller | Papel |
|-----|-----------|-------|
| `/task-executor-monitor` | TaskExecutorMonitor | Monitoramento da máquina de execução de tarefas. |
| `/instance-observability` | InstanceObservability | Log e desempenho por instância (ponte para o daemon). |
| `/repository-manager` | RepositoryManager | Operações sobre os repositórios instalados. |
| `/ecosystem-manager` | EcosystemManager | Operações de orquestração do ecossistema. |
