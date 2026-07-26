# datasource-manager.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/datasource-manager.webapp`
- **Executável:** `sources`
- **Localização:** `Apps.Module/Admin.layer/DataSource.group/datasource-manager.webapp` (PlatformApplicationsRepo)

## Propósito

Composição (`.webapp`) do **Data Source Manager**: interface para configurar e
navegar fontes de dados (file system, data stores e ORM/banco relacional) usadas
por outras aplicações do ecossistema. Sobe o `datasource-manager.webgui`
(front-end) e o `datasource-manager.webservice` (backend) sobre um
`@@/server-service`.

## Execução

Executado pelo Package Executor a partir do executável `sources`. O
`.webapp` não tem código próprio: ele só declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Serviço `@@/datasource-local-manager-service` a partir de `@/datasource-manager.service/services/DataSourceLocalManager`.
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/datasource-manager.webservice/endpoint-group`.
- Endpoint group `@/datasource-manager.webgui/endpoint-group`.
