# meta-project-manager.webapp

- **Tipo:** composição web (`.webapp`)
- **Namespace:** `@/meta-project-manager.webapp`
- **Executável:** `meta-project-manager`
- **Localização:** `Apps.Module/Productivity.layer/MetaProjectManager.group/meta-project-manager.webapp` (PlatformApplicationsRepo)

## Propósito

**Composition root** web do Meta Project Manager (registrado como APP `meta-project-manager`
em `metadata/applications.json`). Molde: `datasource-manager.webapp`.

O `boot.json` sobe um HTTP server (`@/server-manager.service`) e monta, no mesmo servidor:
1. `@/server-manager.webservice/endpoint-group` (status do server-manager),
2. `@/meta-project-manager.webservice/endpoint-group` (a API REST, com `@/project-store.lib` + paths do DB),
3. `@/meta-project-manager.webgui/endpoint-group` (a SPA React, buildada em runtime).

Porta padrão **8894**. Rodar via `repo install ... --executables meta-project-manager` e abrir no navegador.

## Execução

Executado pelo Package Executor a partir do executável `meta-project-manager`. O
`.webapp` não tem código próprio: ele só declara a composição abaixo.

## Composição (`metadata/boot.json`)

- Serviço `@@/server-service` a partir de `@/server-manager.service/services/HTTPServerService` (porta `{{port}}`).
- Endpoint group `@/server-manager.webservice/endpoint-group`.
- Endpoint group `@/meta-project-manager.webservice/endpoint-group`.
- Endpoint group `@/meta-project-manager.webgui/endpoint-group`.
