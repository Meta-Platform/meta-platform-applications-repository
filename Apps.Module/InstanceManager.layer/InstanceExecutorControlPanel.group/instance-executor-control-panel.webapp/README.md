# instance-executor-control-panel.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/instance-executor-control-panel.webapp`
- **Executável:** `executor-panel`
- **Localização:** `Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webapp` (PlatformApplicationsRepo)

## Propósito

Composição (`.webapp`) do **Instance Executor Control Panel** — executável
`executor-panel`. Sobe o `instance-executor-control-panel.webservice` (backend) e o
`instance-executor-control-panel.webgui` (front-end) sobre um `@@/server-service`.

## Execução

Executado pelo Package Executor a partir do executável `executor-panel`. O
`.webapp` não tem código próprio: ele só declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Serviço `@@/repository-manager` a partir de `@/repository-manager.service/services/RepositoryManagerService`.
- Serviço `@@/command-line-runtime` a partir de `@/command-line-runtime.service/services/CommandLineRuntime`.
- Serviço `@@/instance-manager-runtime` a partir de `@/instance-manager-runtime.service/services/InstanceManagerRuntimeService`.
- Endpoint group `@/instance-executor-control-panel.webgui/endpoint-group`.
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/instance-executor-control-panel.webservice/endpoint-group`.
