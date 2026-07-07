# meta-project-manager.webapp

**Composition root** web do Meta Project Manager (registrado como APP `meta-project-manager`
em `metadata/applications.json`). Molde: `datasource-manager.webapp`.

O `boot.json` sobe um HTTP server (`@/server-manager.service`) e monta, no mesmo servidor:
1. `@/server-manager.webservice/endpoint-group` (status do server-manager),
2. `@/meta-project-manager.webservice/endpoint-group` (a API REST, com `@/project-store.lib` + paths do DB),
3. `@/meta-project-manager.webgui/endpoint-group` (a SPA React, buildada em runtime).

Porta padrão **8894**. Rodar via `repo install ... --executables meta-project-manager` e abrir no navegador.
