# meta-project-manager.webservice

- **Tipo:** serviço web, backend HTTP (`.webservice`)
- **Namespace:** `@/meta-project-manager.webservice`
- **Localização:** `Apps.Module/Productivity.layer/MetaProjectManager.group/meta-project-manager.webservice` (PlatformApplicationsRepo)

## Propósito

API REST (+ realtime) do **Meta Project Manager**. Adaptador HTTP fino sobre
`@/project-store.lib` — **não duplica regra de negócio**. Porta standalone: **9094**.

## Arquitetura

- `src/AppContext.js` — **uma** instância do store para todos os controllers +
  emitter/buffer de eventos realtime (alimentado pelo `onEvent` do store).
- `src/Controllers/*.controller.js` — factory `(params) => ({ controllerName, ...métodos })`,
  no padrão do repo. Respostas em envelope `{ ok, data | code/message }` (via `Utils/respond.js`).
- `src/APIs/*.api.json` — descrição declarativa (summary/method/path/parameters).

Contrato de argumentos (server-manager): endpoint com 0 params → método sem args; com
exatamente 1 param presente → **valor posicional**; senão → **objeto** `{...path,...body,...query}`.
Os métodos usam `idOf()` para aceitar ambas as formas com segurança.

## Execução

Não é executado de forma independente (`node index.js`). É montado em runtime
sobre um `@@/server-service` a partir do seu `metadata/endpoint-group.json`,
quando o `meta-project-manager.webapp` ou o `meta-project-manager.desktopapp` é
executado pelo Package Executor.

## Serviços disponibilizados

Um controller por área, espelhando os `src/APIs/*.api.json`: `Projects`,
`Boards`, `Items`, `Comments`, `Attachments`, `Docs`, `Planning`,
`PlanningDocs`, `Risks`, `Reports`, `Users`, `Agents`, `Feedback`, `Events`,
`Activity`, `Ecosystem`, `System` e `Health`.

## Endpoints (spec §8.1)

`GET /health` · `projects` (CRUD+archive/restore/metrics) · `boards` (+columns) ·
`items` (CRUD+move+status+links) · `comments` · `attachments` (+`/download`, `typeResponse:file`) ·
`users` · `agents` (+`/sessions`, confirm/reject/close) · `activity` · `reports/*`.

Coordenação multiagente: **`GET /agent-presence`** (quem está trabalhando agora —
itens e pacotes reivindicados, foco e último sinal de cada sessão),
**`GET|POST /agent-notices`** (avisos entre sessões; o POST deixa o humano falar
com um agente pelo mesmo canal) e **`GET /environment-actions`** (quem subiu ou
derrubou o quê no ambiente compartilhado).

Realtime (spec §8.2): **`GET /events?since=<cursor>`** (polling do browser, retorna
`{ cursor, events }`) e **`ws /events/stream`** (push; `method:"ws"` → `(ws, params)`).
No desktop, o push vem do GUI-host por IPC (ver `meta-project-manager-gui.service`).

## Testes

```bash
npm install express --no-save   # a plataforma provê express em produção
node --test
```
O harness (`test/ws.harness.js`) replica o `CreateAPIEndpointsService` e exercita os
endpoints por HTTP real (12 casos), incluindo o buffer de eventos.
