# meta-project-manager.webservice

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

## Endpoints (spec §8.1)

`GET /health` · `projects` (CRUD+archive/restore/metrics) · `boards` (+columns) ·
`items` (CRUD+move+status+links) · `comments` · `attachments` (+`/download`, `typeResponse:file`) ·
`users` · `agents` (+`/sessions`, confirm/reject/close) · `activity` · `reports/*`.

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
