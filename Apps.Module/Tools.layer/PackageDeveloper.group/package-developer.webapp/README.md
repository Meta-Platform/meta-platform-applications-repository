# package-developer.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/package-developer.webapp`
- **Executável:** `developer`
- **Localização:** `Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.webapp` (PlatformApplicationsRepo)

## Propósito

Composição (`.webapp`) do **Package Developer**: ambiente para criar e desenvolver
packages da plataforma. Sobe o `package-developer.webgui` (front-end) e o
`package-developer.webservice` (backend) sobre um `@@/server-service`.

## Execução

Executado pelo Package Executor a partir do executável `developer`. O
`.webapp` não tem código próprio: ele só declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Serviço `@@/package-handler-service` a partir de `@/package-developer.lib/services/PackageHandlerManager`.
- Serviço `@@/package-process-service` a partir de `@/package-process-manager.lib/services/ProcessManager`.
- Serviço `@@/git-status-service` a partir de `@/git-status.lib/services/GitStatusManager`.
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/package-developer.webservice/endpoint-group`.
- Endpoint group `@/package-developer.webgui/endpoint-group`.
