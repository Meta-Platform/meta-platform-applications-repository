# project-store.lib

Camada de domínio, persistência (SQLite via Sequelize) e auditoria do **Meta Project Manager**.
É a **única** fonte de regra de negócio — a CLI (`meta-project-manager.cli`), o servidor MCP
(`meta-project-manager-mcp.cli`) e o webservice (`meta-project-manager.webservice`) são
adaptadores finos que reusam este store (spec §10.1). O **gate de aprovação humana**, o **soft
delete**, as **permissões** e a **auditoria com diff** vivem aqui, não nos adaptadores.

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
- `actor` = `{ actorUserId, actorSessionId, source, session }` (`source` ∈ `gui|cli|api|agent|mcp|desktop`)
  alimenta a auditoria. Um actor com `.session` (identidade inline) é tratado como **agente** e cai no gate.
- Erros são `DomainError` com `.code` estável (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
  `FORBIDDEN`, `AGENT_SESSION_CONFIRMATION_REQUIRED`) — ver `src/Errors.js`.
- **Soft delete** (`deletedAt`) em entidades importantes; nada é apagado fisicamente por padrão.
- **Auditoria**: toda mutação relevante grava um `audit_events` (helper `WriteAudit`) com diff
  `beforeJson`→`afterJson`, `actorType`, `source` e snapshot da identidade do agente (`provider`/`model`/`traceId`).
- **Sessão de agente**: `RegisterSession` sem `confirm` cria `pending_confirmation`; `ConfirmSession`/`RejectSession`/`CloseSession` transicionam. O modelo é sempre armazenado.

## Gate de aprovação (agentes)

`AgentsStore` centraliza o gate. Toda ação sensível de um **agente** (actor com `.session`)
não é executada na hora: vira um **pedido pendente** (`CreationRequest`, modelo generalizado)
que um humano aprova (a ação é executada de fato) ou rejeita.

- Cobertura: **criação** de `project|board|milestone|sprint` e **remoção** (`actionName: "delete"`)
  de `project|board|item`. Delete carrega `targetId` e `risk: "destructive"`.
- `RequestApproval({ actionName, type, targetId, payload, risk, resumeToken, actor })` cria o
  pedido. `resumeToken` dá **idempotência** (retry reusa o pendente).
- `ApproveRequest({ request, actor })` executa a ação (create OU delete, com um actor sem
  `.session` para não re-disparar o gate); falha na execução ⇒ status `failed` com `errorSnapshot`.
- `RejectRequest({ request, reason, actor })` rejeita (motivo auditado).
- `WaitForApproval({ request, timeoutMs })` faz polling do SQLite (processos separados via WAL)
  até o pedido sair de `pending`; devolve `result`/`error`. É o que permite CLI/MCP **aguardarem**
  a decisão e **retomarem**.
- `DescribeDeletionImpact({ type, targetId })` conta o que a remoção afeta em cascata
  (boards/itens/anexos/comentários); `DescribeCreationRequest`/`ListCreationRequests` enriquecem
  o pedido com **quem** pediu (provider/modelo/sessão/objetivo) e o **impacto** — a GUI usa isso.

## Notas de atividade e permissões

- **`ActivityStore`**: `AddActivityNote` (sem autor humano ⇒ atribui ao `usuario-desktop` via
  `EnsureDesktopUser`), `ListActivityNotes` (por escopo `project|board|sprint|milestone|item`;
  sem escopo ⇒ **consulta global**, exige permissão), `GetActivityContext` (notas humanas +
  auditoria recente do escopo, para o agente se situar). Nota ≠ Comment ≠ AuditEvent.
- **`UsersStore`**: permissões simples em `User.permissionsJson`. `AssertGlobalActivityAccess`
  barra **apenas agentes** sem `activity:read:all_projects` em consultas globais; humanos seguem
  livres. `EnsureDesktopUser` semeia o usuário automático `usuario-desktop` (`type: desktop`)
  no boot, idempotente.
- **`AuditStore`**: `MakeListActivity` (filtros: `action`, `actorType`, `source`, `provider`,
  `model`, `sessionId`, `traceId`, `from`/`to`, escopo) e `GetAuditEvent` (evento único
  hidratado com `before`/`after`).
- **`shortDescription`** (`Project`/`Board`/`Milestone`/`Sprint`): `<=240` chars
  (`SHORT_DESCRIPTION_MAX`), **aceita vazio** e **nunca grava fallback** derivado da `description`.

## Estrutura

```
src/
  InitializeProjectStore.js   # factory: costura models + audit + emit + stores
  DefineModels.js             # modelos Sequelize (spec §9.1) — inclui ActivityNote
  Config.js                   # status/tipos/prioridades/permissões/aprovação/escopos
  Errors.js                   # DomainError + mapa HTTP
  Utils/helpers.js            # ids, slug, sanitização, sha256, serialização
  Store/
    ProjectsStore.js  BoardsStore.js  WorkItemsStore.js  PlanningStore.js
    AttachmentsStore.js  CommentsStore.js  UsersStore.js
    AgentsStore.js  ActivityStore.js  ReportsStore.js  AuditStore.js  ImportExportStore.js
test/store.test.js            # node --test (spec §14.1)
```

## Testes

```bash
node --test
```
