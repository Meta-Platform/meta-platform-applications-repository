# project-store.lib

Camada de domínio, persistência (SQLite via Sequelize) e auditoria do **Meta Project Manager**.
É a **única** fonte de regra de negócio — a CLI (`meta-project-manager.cli`) e o webservice
(`meta-project-manager.webservice`) são adaptadores finos que reusam este store (spec §10.1).

Segue o idioma de `workspace-store.lib`: uma factory que recebe o caminho do `.sqlite` e
retorna métodos async; `sequelize.sync()` cria/atualiza o schema (sem migrations manuais).

## Uso

```js
const InitializeProjectStore = require("@/project-store.lib").require("InitializeProjectStore")

const store = InitializeProjectStore({
    storage: "~/virtual-desk-state/local-databases/meta-project-manager.sqlite",
    attachmentsDirPath: "~/virtual-desk-state/meta-project-manager/attachments",
    onEvent: (evt) => { /* realtime: { type, payload, createdAt } */ }
})
await store.ConnectAndSync()

const project = await store.CreateProject({ name: "Meta Platform", actor: { source: "cli" } })
const board   = await store.CreateBoard({ project: project.slug, name: "Development" })
const story   = await store.CreateItem({ project: project.keyPrefix, type: "story", title: "..." })
```

## Convenções

- Todo método recebe **um objeto** e retorna **JSON plano** (datas em ISO) — compatível com HTTP e IPC.
- Referências aceitam **id, slug ou key**: `project` (id|slug|keyPrefix), `item` (id|key), `user` (id|handle).
- `actor` = `{ actorUserId, actorSessionId, source }` (`source` ∈ `gui|cli|api|agent`) alimenta a auditoria.
- Erros são `DomainError` com `.code` estável (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
  `FORBIDDEN`, `AGENT_SESSION_CONFIRMATION_REQUIRED`) — ver `src/Errors.js`.
- **Soft delete** (`deletedAt`) em entidades importantes; nada é apagado fisicamente por padrão.
- **Auditoria**: toda mutação relevante grava um `audit_events` (helper `WriteAudit`).
- **Sessão de agente**: `RegisterSession` sem `confirm` cria `pending_confirmation`; `ConfirmSession`/`RejectSession`/`CloseSession` transicionam. O modelo é sempre armazenado.

## Estrutura

```
src/
  InitializeProjectStore.js   # factory: costura models + audit + emit + stores
  DefineModels.js             # 14 modelos Sequelize (spec §9.1)
  Config.js                   # status/tipos/prioridades/relações padrão
  Errors.js                   # DomainError + mapa HTTP
  Utils/helpers.js            # ids, slug, sanitização, sha256, serialização
  Store/
    ProjectsStore.js  BoardsStore.js  WorkItemsStore.js
    AttachmentsStore.js  CommentsStore.js  UsersStore.js
    AgentsStore.js  ReportsStore.js  AuditStore.js  ImportExportStore.js
test/store.test.js            # node --test (16 casos, spec §14.1)
```

## Testes

```bash
node --test
```
