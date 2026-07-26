# api-designer.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/api-designer.webapp`
- **Executável:** `api-designer-webapp`
- **Localização:** `Apps.Module/Tools.layer/APIDesigner.group/api-designer.webapp` (PlatformApplicationsRepo)

## Propósito

Aplicação usada para a edição de arquivos example.api.json

## Execução

Executado pelo Package Executor a partir do executável `api-designer-webapp`. O
`.webapp` não tem código próprio: ele só declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/api-designer.webservice/endpoint-group`.
- Endpoint group `@/api-designer.webgui/endpoint-group`.
