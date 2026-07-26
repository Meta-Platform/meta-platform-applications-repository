# launcher.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/launcher.webapp`
- **Executável:** `launcher`
- **Localização:** `Apps.Module/InstanceManager.layer/Launcher.group/launcher.webapp` (PlatformApplicationsRepo)

## Propósito

Composição (`.webapp`) do **Launcher** — executável `launcher`. Sobe o
`launcher.webservice` (backend) e o `launcher.webgui` (front-end) sobre um
`@@/server-service`.

É a variante web do app; a variante desktop é o `launcher.desktopapp`, que
dispensa o servidor HTTP e hospeda os mesmos services por IPC.

## Execução

Executado pelo Package Executor a partir do executável `launcher`. O `.webapp`
não tem código próprio: ele só declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Serviço `@@/repository-manager` a partir de `@/repository-manager.service/services/RepositoryManagerService`.
- Serviço `@@/command-line-runtime` a partir de `@/command-line-runtime.service/services/CommandLineRuntime`.
- Serviço `@@/instance-manager-runtime` a partir de `@/instance-manager-runtime.service/services/InstanceManagerRuntimeService`.
- Endpoint group `@/launcher.webgui/endpoint-group`.
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/launcher.webservice/endpoint-group`.

> Veja o [README do repositório](../../../../README.md).
