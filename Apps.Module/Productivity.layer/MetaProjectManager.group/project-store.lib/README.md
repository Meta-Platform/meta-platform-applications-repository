# project-store.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/project-store.lib`
- **Localização:** `Apps.Module/Productivity.layer/MetaProjectManager.group/project-store.lib` (PlatformApplicationsRepo)

## Propósito

Camada de domínio, persistência (SQLite via Sequelize) e auditoria do **Meta Project Manager**.
É a **única** fonte de regra de negócio — a CLI (`meta-project-manager.cli`), o servidor MCP
(`meta-project-manager-mcp.cli`) e o webservice (`meta-project-manager.webservice`) são
adaptadores finos que reusam este store (spec §10.1). O **gate de aprovação humana**, o **soft
delete**, as **permissões** e a **auditoria com diff** vivem aqui, não nos adaptadores.

Segue o idioma de `workspace-store.lib`: uma factory que recebe o caminho do `.sqlite` e
retorna métodos async; `sequelize.sync()` cria/atualiza o schema (sem migrations manuais).

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `InitializeProjectStore.ts` | Entrada: conecta no SQLite, sincroniza os modelos e devolve o store completo. |
| `DefineModels.ts` · `Config.ts` · `Errors.ts` | Modelos Sequelize, configuração e erros de domínio. |
| `Store/ProjectsStore.ts` · `BoardsStore.ts` · `WorkItemsStore.ts` | Projetos, boards e itens de trabalho. |
| `Store/PlanningStore.ts` · `PlanningDocsStore.ts` · `RisksStore.ts` | Entregas, sprints, charter e riscos. |
| `Store/DocsStore.ts` · `DocAttachmentsStore.ts` · `DocsExportStore.ts` | Wiki de páginas, anexos por página e exportação HTML/ZIP. |
| `Store/CommentsStore.ts` · `AttachmentsStore.ts` · `FeedbackStore.ts` | Comentários, anexos de item e a fila de feedback para agentes. |
| `Store/AgentsStore.ts` · `AuditStore.ts` · `ActivityStore.ts` | Sessões de agente, auditoria e notas de atividade. |
| `Store/PresenceStore.ts` | Coordenação entre sessões: quem está aqui, entrada/saída, avisos entregues e ambiente compartilhado. |
| `Store/ReportsStore.ts` · `AnalyticsStore.ts` | Relatórios e métricas. |
| `Store/EcosystemStore.ts` | Catálogo de pacotes reais do ecossistema e o vínculo item↔pacote. |
| `Store/UsersStore.ts` · `ImportExportStore.ts` | Usuários e importação/exportação. |
| `Utils/ecosystemPath.ts` | `ParsePackagePath` e `PackageRef` — como um pacote é identificado. |
| `Utils/helpers.ts` · `zip.ts` | Utilitários gerais e geração de ZIP sem dependência externa. |

## Uso

```ts
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
  `FORBIDDEN`, `AGENT_SESSION_CONFIRMATION_REQUIRED`) — ver `src/Errors.ts`.
- **Soft delete** (`deletedAt`) em entidades importantes; nada é apagado fisicamente por padrão.
- **Auditoria**: toda mutação relevante grava um `audit_events` (helper `WriteAudit`) com diff
  `beforeJson`→`afterJson`, `actorType`, `source` e snapshot da identidade do agente (`provider`/`model`/`traceId`).
- **Sessão de agente**: `RegisterSession` sem `confirm` cria `pending_confirmation`; `ConfirmSession`/`RejectSession`/`CloseSession` transicionam. O modelo é sempre armazenado.

## Gate de aprovação (agentes)

`AgentsStore` centraliza o gate. Toda ação sensível de um **agente** (actor com `.session`)
não é executada na hora: vira um **pedido pendente** (`CreationRequest`, modelo generalizado)
que um humano aprova (a ação é executada de fato) ou rejeita.

- Cobertura: definida em **`Config.AGENT_GATE_POLICY`** — a fonte única. `GateAgentAction`
  consulta esse mapa antes de criar o pedido, e `AgentGatePolicy()` o devolve para quem precisa
  DOCUMENTAR o gate (o `get_guidance` do MCP), em vez de manter uma segunda lista à mão.
  Hoje: **criação** de `project|board|column`; **remoção** de `project|board|item|milestone|sprint|column|checklist-item|acceptance-criteria|risk|doc-page|planning-doc`;
  alteração de identidade/ciclo de vida do projeto; **iniciar/concluir** tarefa. Criar
  marco e sprint é **livre**. Delete carrega `targetId` e `risk: "destructive"`.
  > Um par (ação, tipo) fora da política passa direto: nenhuma call-site inventa um gate que a
  > orientação não anuncia — foi essa divergência que fez o agente esperar aprovações inexistentes.
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

## Gate de status: uma regra, todos os caminhos

O gate de iniciar/concluir vive na **camada que muda o status**, não na tool:
`UpdateItem({ statusKey })` delega ao `SetStatus`, então não existe caminho lateral para
começar ou concluir uma tarefa sem aprovação. Em volta dele:

- **`UnmetAcceptanceCriteria`**: concluir devolve os critérios que ainda não foram marcados
  (e o pedido de aprovação os carrega para a tela do humano). Fechar pelo commit em vez do
  critério já deixou passar item incompleto — agora o esquecimento vira aviso.
- **`SetStatusBatch`** + **`DecideRequests`**: um pedido para N itens, e uma decisão humana
  para N pedidos. O gate por item é correto e insuportável na escala (74 itens = ~150
  diálogos), e humano que carimba não lê — o oposto do que ele existe para garantir.
- **`STALE_APPROVAL`**: aprovar um pedido cujo alvo já saiu do status de origem é recusado
  (o pedido vira `expired`, preservado para auditoria) em vez de reverter, horas depois, um
  trabalho que seguiu em frente.

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
- **`shortDescription`** (`Project`/`Board`/`WorkItem`/`Milestone`/`Sprint`): `<=240` chars
  (`SHORT_DESCRIPTION_MAX`, validado por `AssertShortDescription`), **aceita vazio** e **nunca
  grava fallback** derivado da `description`.

## Coordenação entre agentes (`PresenceStore`)

Vários agentes atuam no mesmo workspace — e no mesmo checkout — ao mesmo tempo. O que já
existia respondia *quem pode escrever* (status da sessão) e *quem está com qual item*
(claim). Faltavam duas coisas, e as duas custaram trabalho jogado fora:

- **Presença**: `AgentSession.presence` (`here` → `idle` após 15 min → `gone` após 60) é um
  eixo separado do `status`. Sessão liberada que morreu continua `active` para sempre, e é
  ela que faz o quadro mentir. `SweepPresence()` roda **na leitura** (sem processo de fundo);
  `WhoIsHere({ project })` devolve, numa chamada, cada sessão viva com os itens e **pacotes**
  que segura, o foco atual e o último progresso relatado.
- **Avisos entregues** (`AgentNotice`): entrada/saída de agente, recado dirigido de uma sessão
  a outra e mexida em ambiente compartilhado. `CollectNotices({ actor })` é chamado pela camada
  de transporte a cada resposta — o aviso **chega** em vez de esperar consulta, porque quem
  precisa dele é justamente quem não sabe que precisa perguntar. Broadcast usa o cursor
  `noticeCursorAt` da sessão (sem tabela de entrega N:M); dirigido fecha com `readAt`.

Na mesma frente: `NextTask` (escolhe da fila de `Ready` **e reivindica** na mesma chamada,
fechando a janela em que dois agentes pegam o mesmo item), `ListItems` que **omite** item com
claim viva de outra sessão (`includeClaimed:true` mostra tudo, com `claim` no resumo),
`WorkItem.pendingStatusKey` (status pedido e ainda não aprovado, para o board não mentir) e
`RecordEnvironmentAction` (nota de tipo `environment`, consultável por tipo).

## Planejamento consultável

O que classifica, dimensiona ou sequencia o trabalho é **campo**, não texto na descrição —
só assim filtra, soma e navega:

- **`labels`** (JSON no item): normalizados (sem espaços/duplicatas) por `NormalizeLabels`,
  filtráveis em `ListItems({ label })` e agregados em `ListProjectLabels`.
- **`area`**: texto livre, mas a escrita **adota a grafia já usada no projeto** quando difere só
  por caixa/acento/separador (`ListProjectAreas` mostra o vocabulário e as variantes remanescentes).
- **`effort`** (`xs…xl`) + **`confidence`** (`low|medium|high`): `ListMilestones`/`GetMilestone`
  somam o esforço por `WORK_ITEM_EFFORT_WEIGHTS` e devolvem `effortProgress` (progresso por
  esforço, não por contagem) e a distribuição de confiança.
- **`RiskItemLink`**: risco ↔ item (`mitigates|triggers|relates`) — `GetItem` traz `risks`,
  `GetRisk` traz `items`, `ListRisks({ item })` filtra.
- **`MilestoneLink`**: dependência entre entregas (`depends|blocks`), com ciclo recusado;
  `Roadmap` sai em ordem topológica e cada marco informa `dependenciesMet`/`pendingDependencies`.
- **`Ready({ project })`**: o que está pronto para começar — dependências fechadas, sem bloqueio
  e com a entrega liberada — ordenado por quantos itens cada um destrava.
- **`EcosystemIndexStatus()`**: estado do catálogo de pacotes por leitura pura (sem indexar).
- **`ResolveMilestone`/`ResolveSprint`** aceitam **id OU nome** (`ListItems({ milestone: "M1 — Fundação" })`
  funciona): antes só o id casava e o nome devolvia zero itens **sem erro**, fazendo uma entrega
  cheia parecer vazia. Nome ambíguo recusa listando os candidatos.

## Estrutura

```
src/
  InitializeProjectStore.ts   # factory: costura models + audit + emit + stores
  DefineModels.ts             # modelos Sequelize (spec §9.1) — inclui ActivityNote
  Config.ts                   # status/tipos/prioridades/permissões/aprovação/escopos
  Errors.ts                   # DomainError + mapa HTTP
  Utils/helpers.ts            # ids, slug, sanitização, sha256, serialização
  Store/
    ProjectsStore.ts  BoardsStore.ts  WorkItemsStore.ts  PlanningStore.ts
    AttachmentsStore.ts  CommentsStore.ts  UsersStore.ts
    AgentsStore.ts  ActivityStore.ts  PresenceStore.ts  ReportsStore.ts  AuditStore.ts
    ImportExportStore.ts
    DocsStore.ts  RisksStore.ts  PlanningDocsStore.ts  EcosystemStore.ts  FeedbackStore.ts
test/store.test.js            # node --test (spec §14.1)
```

## Testes

```bash
node --test
```
