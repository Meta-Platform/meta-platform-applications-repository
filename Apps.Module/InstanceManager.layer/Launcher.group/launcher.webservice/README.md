# instance-executor-control-panel.webservice

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

## Endpoints (controllers)

| URL | Controller | Papel |
|-----|-----------|-------|
| `/task-executor-monitor` | TaskExecutorMonitor | Monitoramento da máquina de execução de tarefas. |
| `/repository-manager` | RepositoryManager | Operações sobre os repositórios instalados. |
| `/ecosystem-manager` | EcosystemManager | Operações de orquestração do ecossistema. |
