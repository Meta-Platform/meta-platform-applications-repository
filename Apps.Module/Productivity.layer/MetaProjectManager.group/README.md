# MetaProjectManager.group

**Meta Project Manager** — gestor de projetos, boards, histórias, tarefas, subtarefas,
anexos e colaboração entre **humanos e agentes de IA** dentro da Meta Platform.

Regra central: **paridade GUI/CLI/MCP** — toda ação relevante existe nas três frentes.
A GUI é para humanos; a CLI (`mpm`) e o **servidor MCP** são otimizados para agentes de IA
(saída `--json` / tools MCP, não-interativos, idempotentes).

## Pacotes

| Pacote | Papel |
|---|---|
| `project-store.lib` | Domínio, persistência (SQLite/Sequelize) e auditoria. **Única fonte de regra de negócio.** |
| `meta-project-manager.webservice` | API REST + WebSocket (`/events`) sobre o store. |
| `meta-project-manager.webgui` | UI React/TS (board Kanban, lista hierárquica, inspector, usuários/agentes, relatórios, **Auditoria**, **Manual & Glossário**). |
| `meta-project-manager-gui.service` | Serviço GUI-host (IPC) usado pelo desktop. |
| `meta-project-manager.webapp` | Composition root web (server + webservice + webgui) — registrado como **APP**. |
| `meta-project-manager.desktopapp` | Shell Electron (GUI-host) — registrado como **DESKTOP**. |
| `meta-project-manager.cli` | CLI `mpm` (paridade com a GUI). |
| `meta-project-manager-mcp.cli` | Servidor **MCP (stdio)** para agentes de IA (Claude Code, Codex…) — expõe tools nativas sobre o mesmo store/gate/auditoria. Executável `meta-project-manager-mcp`. Ver seu `README.md`. |

Arquitetura (spec §10.1): **CLI, webservice e MCP não duplicam regra** — todos reusam
`@/project-store.lib`. A GUI fala com o webservice (HTTP) ou com o gui.service (IPC no desktop);
o agente de IA fala pela CLI (`--json`) ou pelo servidor MCP (tools).

```
GUI     ─HTTP→ webservice ─┐
CLI  (mpm) ─────────────────┤
MCP (stdio) ────────────────┼─→ project-store.lib (use cases + SQLite + auditoria)
Desktop ─IPC→ gui.service ──┘
```

> **Nota de tipo de pacote:** o servidor MCP é um **`.cli`** (a plataforma não tem tipo `.mcp`;
> extensões válidas: `app|cli|webapp|desktopapp|webgui|webservice|service|lib`). Um servidor
> MCP stdio é, mecanicamente, um executável de command-group — igual ao `instance-manager-daemon.cli`.

## Como rodar

Provisionamento local (LOCAL_FS):

```bash
repo install ApplicationsRepository LOCAL_FS \
  --executables meta-project-manager meta-project-manager-desktop mpm meta-project-manager-mcp
# após editar código:
repo update ApplicationsRepository
```

- **Web (browser):** executa o app `meta-project-manager` (APP) → abre a webgui servida pelo webapp.
- **Desktop (Electron):** executa `meta-project-manager-desktop` (DESKTOP, GUI-host).
- **CLI:** `mpm --help` (ou o alias `meta-project-manager`). Ver `meta-project-manager.cli/README.md`.
- **MCP (agentes):** registre `meta-project-manager-mcp serve` no cliente (Claude Code: `claude mcp add … -- <caminho absoluto>/meta-project-manager-mcp serve`; Codex: bloco `[mcp_servers.…]` em `~/.codex/config.toml`). Passo a passo no Guia de IA da GUI e em `meta-project-manager-mcp.cli/README.md`. **Aqueça 1x após instalar** (o 1º run constrói o ambiente e loga em stdout).

## Autorização de agentes (gate de aprovação)

Regra: **toda ação sensível de um agente vira um "pedido de aprovação" pendente**; um humano
precisa **aprovar** (aí a ação é executada de fato) ou **rejeitar**. O gate cobre:

- **Criação** de `project`, `board`, `milestone` e `sprint`.
- **Remoção** (delete) de `project`, `board` e `item` — sempre **SOFT delete** (`deletedAt`,
  reversível), com `risk: "destructive"`.

Itens (histórias/tarefas/subtarefas) e mudança de status **não** passam pelo gate — o agente
atua neles livremente.

- O agente se identifica **inline**: na CLI, flags `--session-provider/--session-model/
  --session-trace/--session-external-id/--session-agent` (a CLI captura host, usuário do SO,
  PID, diretório e git automaticamente); no MCP, a identidade é fixada uma vez no startup do
  servidor; na API, campos `sessionProvider/sessionModel/...` no corpo.
- Ao bloquear, o store lança `AGENT_SESSION_CONFIRMATION_REQUIRED` com `pendingCreationId`,
  `actionName` (`create|delete`) e `nextCommands` (`mpm agent creation approve|reject <id>`).
- **Espera e retomada automática (padrão para agente):** a CLI e o MCP, por padrão,
  **AGUARDAM** a decisão humana (polling do SQLite via WAL) e **retomam** sozinhos — sucesso
  devolve o resultado da ação; rejeição/timeout/falha viram erro estruturado
  (`REJECTED_BY_HUMAN`, `APPROVAL_TIMEOUT`, `APPROVAL_EXECUTION_FAILED`). Use `--no-wait`
  (CLI) ou `waitApproval:false` (MCP) para o comportamento antigo (retorna o `pendingCreationId`
  e sai). Idempotência via `resumeToken`: retries não duplicam o pendente.
- O humano decide na CLI (`mpm agent creation list/approve/reject [--reason]`), na API
  (`GET /creation-requests`, `POST /creation-requests/:id/approve|reject`) ou na GUI. Aprovar
  **executa** a ação. **Aprovar/rejeitar são sempre ações humanas** — nunca tools do MCP.
- A GUI mostra **o QUE** será afetado (impacto em cascata: boards/itens/anexos/comentários
  contados para delete) e **QUEM** pediu (provider/modelo/sessão/objetivo). Um **modal GLOBAL
  de aprovação** aparece em qualquer tela quando há pedido pendente; ações destrutivas de
  humanos usam o `ConfirmActionModal` (não se usa mais `window.confirm`).

## Notas de atividade, usuário desktop e auditoria

- **`shortDescription`** (`<=240` chars, aceita vazio): resumo de uma linha em `Project`,
  `Board`, `Milestone` e `Sprint`, usado em cards, sidebar, header e busca. Nunca grava um
  fallback derivado da `description` (o fallback é só visual, na GUI).
- **Usuário `usuario-desktop`**: usuário automático (`type: desktop`) semeado no boot. Recebe
  as **notas de atividade** feitas sem autor humano explícito (ações manuais do ambiente local).
- **Notas de atividade (`ActivityNote`)**: anotações humanas (ou do `usuario-desktop`) num
  escopo (`project|board|sprint|milestone|item|global`). Distintas de **Comment** (preso a um
  item, conversa sobre a tarefa) e de **AuditEvent** (imutável, gerado pelo sistema). Agentes
  podem **ler** as notas para reagir ao contexto.
- **Auditoria**: cada mutação grava um `AuditEvent` imutável com **diff antes→depois**
  (`beforeJson`/`afterJson`), `actorType` (`human|agent|desktop|system`), `source` e o snapshot
  da identidade do agente (`provider`/`model`/`traceId`). Filtros ricos por ação, ator, tipo de
  ator, fonte, provider, modelo, sessão e período. A GUI tem uma tela **Auditoria** dedicada.
- **Permissões** (`User.permissionsJson`): consulta de atividade/auditoria de **TODOS** os
  projetos (sem informar projeto) exige `activity:read:all_projects` / `audit:read:all_projects`.
  Essa exigência **só barra AGENTES** — humanos na GUI/CLI seguem livres. No MCP, `list_activity`
  sem `project` retorna `FORBIDDEN` se o agente não tiver a permissão.

## Persistência

- Banco: `~/virtual-desk-state/local-databases/meta-project-manager.sqlite`
- Anexos: `~/virtual-desk-state/meta-project-manager/attachments/<projectId>/<attachmentId>/`

Migrations não são manuais — `sequelize.sync()` cria/atualiza o schema (idioma de `workspace-store.lib`).

## Testes

```bash
( cd project-store.lib && node --test )                       # domínio
( cd meta-project-manager.cli && npm i yargs --no-save && node --test )   # CLI (gate, delete, notas, auditoria)
```

## Contratos que costumam pegar de surpresa

- **`keyPrefix`**: informado explicitamente, é **validado** (letras/números, no máximo 5) e
  devolve `VALIDATION_ERROR` com `details.suggestion` — nunca é truncado em silêncio. O prefixo
  **derivado do nome** continua sendo cortado sem erro.
- **Board padrão**: `Project.defaultBoardId` e `Board.isDefault` são mantidos coerentes; o
  **primeiro** board de um projeto vira padrão automaticamente.
- **Vínculos entre itens**: as relações aceitas são exatamente
  `blocks`, `depends`, `relates`, `duplicates`, `implements`, `tests` (não `depends-on`/`relates-to`).
- **Vincular item a milestone/sprint**: use `AssignItemPlanning` (CLI `mpm item set-milestone` /
  `set-sprint`; MCP `assign_item_planning`). Criar o milestone **não** vincula itens sozinho.
- **Anexos por link**: `AddLinkAttachment` aceita `http`, `https` e `file://` (referência a arquivo
  local, sem copiar o conteúdo). Para guardar o arquivo, use `AddFileAttachment`.
- **Auditoria**: o diff `before`/`after` existe para **mutações que alteram campos**
  (update, set-status, assign, block, move, convert, assign-planning…). Eventos de `create`,
  `request` e `approve` não têm diff — não havia valor anterior.
- **Notas de atividade**: a autoria segue humano explícito → usuário-agente (quando há sessão de
  agente) → `usuario-desktop` como fallback.
