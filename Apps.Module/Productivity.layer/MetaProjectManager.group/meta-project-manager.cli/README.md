# meta-project-manager.cli (`mpm`)

CLI do **Meta Project Manager**, com **paridade funcional com a GUI** e desenhada para
operação por **agentes de IA** (spec §7, §12). Reusa a mesma camada de domínio
(`@/project-store.lib`) — nenhuma regra de negócio é duplicada.

Executáveis: `mpm` (e o alias `meta-project-manager`).

## Convenções (spec §7.1, §12.1)

- **`--json`** em qualquer comando → envelopes estáveis `{ ok:true, data }` /
  `{ ok:false, code, message, details }`. Sem `--json`, saída humana resumida.
- Ações destrutivas exigem **`--confirm`** (ou `--yes`); aceitam **`--dry-run`**.
- **`--actor-user-id`** / **`--actor-session-id`** rastreiam o autor (auditoria);
  com `--actor-session-id` a origem vira `agent`.
- Referências aceitam **id, slug ou key**: `--project` (id|slug|key), `[item]` (id|key),
  `--assignee`/`--user` (id|handle).
- **`--short-description`** (`<=240` chars, aceita vazio) em `project`/`board`/`milestone`/`sprint`
  create/update — resumo de uma linha; nunca gera fallback da `description`.
- Erros com **códigos estáveis**: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
  `CONFIRMATION_REQUIRED`, `FORBIDDEN`, `AGENT_SESSION_CONFIRMATION_REQUIRED`,
  `REJECTED_BY_HUMAN`, `APPROVAL_TIMEOUT`, `APPROVAL_EXECUTION_FAILED`.

## Fluxo típico de agente (spec §12.2)

```bash
# 1. Registrar sessão (sem --confirm retorna AGENT_SESSION_CONFIRMATION_REQUIRED)
mpm agent session register --agent claude-kaio --model claude-sonnet-4 \
    --description "Implementar CRUD" --trace-id TRACE-001 --confirm --json

# 2. Criar tarefa rastreada pela sessão
mpm task create --project MPM --title "Implementar CRUD de WorkItem" \
    --assignee claude-kaio --actor-session-id SESSION_ID --json

# 3. Atualizar status / comentar / anexar log
mpm item set-status MPM-42 --status in-progress --actor-session-id SESSION_ID --json
mpm comment add MPM-42 --body "Use cases prontos." --actor-session-id SESSION_ID --json
mpm attachment add MPM-42 --file ./test-output.log --actor-session-id SESSION_ID --json
```

## Identidade de agente e gate de aprovação

Se o comando trouxer flags de identidade de sessão (`--session-provider`, `--session-model`,
`--session-trace`, `--session-external-id`, `--session-agent`, `--session-owner`), o actor
vira **agente inline** e a CLI captura automaticamente host, usuário do SO, PID, diretório e
git (repo/branch/commit). Nesse modo caem no gate:

- **Criação** de projeto, board, milestone e sprint.
- **Remoção** (`delete`) de projeto, board e item — sempre **SOFT delete** (reversível).

Itens (histórias/tarefas/subtarefas) e mudança de status seguem **livres**.

**Espera e retomada (padrão).** Ao disparar o gate, por padrão a CLI **AGUARDA** a decisão
humana (polling do SQLite) e **retoma** sozinha: aprovado ⇒ devolve o resultado da ação;
rejeitado/timeout/falha ⇒ erro estruturado (`REJECTED_BY_HUMAN` / `APPROVAL_TIMEOUT` /
`APPROVAL_EXECUTION_FAILED`). Controle:

- `--no-wait` — comportamento antigo: retorna `AGENT_SESSION_CONFIRMATION_REQUIRED` com
  `details.pendingCreationId` (e `details.actionName`) e sai.
- `--approval-timeout <segundos>` — teto da espera (`0`/omitido = sem timeout).

Um humano decide com `mpm agent creation list|approve|reject [--reason] <id>`.

```bash
# agente tenta criar board -> aguarda a aprovação e retoma (bloqueia até decisão)
mpm board create --project MPM --name Dev \
  --session-provider claude --session-model claude-sonnet-4 --session-trace T-1 --json

# em outra sessão, o humano aprova (executa a criação) ou rejeita com motivo
mpm agent creation list --json
mpm agent creation approve <pendingCreationId> --json
mpm agent creation reject  <pendingCreationId> --reason "duplicado" --json

# agente remove um item -> mesmo gate (soft delete); --no-wait não espera
mpm item delete MPM-42 --confirm --no-wait \
  --session-provider claude --session-model claude-sonnet-4 --session-trace T-2 --json
```

## Grupos de comandos

`project` · `board` (+`column`) · `story|task|subtask` · `item` (create/list/show/update/
set-status/assign/move/move-to-board/reorder/convert/block/link/unlink/delete/checklist-add/
checklist-update/checklist-remove/acceptance-add/acceptance-update/acceptance-remove) ·
`attachment` · `comment` · `user` · `agent` (+`session`, +`creation`) · `report` ·
`activity` (`list` + `note add/list`) · `audit` (`list`/`show`) · `milestone` · `sprint` ·
`roadmap` · `epic` · `feature` · `inbox` · `backlog` · `export` · `import`.

**Atividade e auditoria:**

- `mpm activity note add --item MPM-42 --text "..."` — anotação num escopo
  (`--project/--board/--sprint/--milestone/--item`). Sem autor humano ⇒ atribuída ao
  `usuario-desktop`. `mpm activity note list --project MPM` lista por escopo.
- `mpm activity list` / `mpm audit list` — eventos de auditoria com filtros ricos
  (`--action --actor-type --source --provider --model --session --from --to`). Sem `--project`
  é **consulta global** (`--all-projects`) — para **agentes** exige `activity:read:all_projects`.
  `mpm audit show <event>` traz o diff **antes→depois**.

**Planejamento:** `inbox add/list` (captura de ideias, `horizon=inbox`), `backlog list`
(`--horizon --area --sort value`), `epic/feature create`, `roadmap --by horizon`,
`item set-horizon/set-clarity/set-effort/set-value/set-area`, e `item set-milestone/set-sprint`.
`item create/update` aceitam `--horizon/--clarity/--effort/--value/--area/--idea-origin`;
`item list` filtra por todos eles. Tipos: epic/feature/story/task/subtask/bug/improvement/
refactor/documentation/research/automation/tech-debt/decision. Criar milestone/sprint por
agente entra no gate de criação.

Veja a árvore completa em `metadata/command-group.json`. Rode `mpm <grupo> --help`.

## Testes

```bash
npm install yargs --no-save   # a plataforma provê yargs em produção; necessário só p/ o harness
node --test
```
O harness (`test/cli.harness.js`) replica o `CommandApplication.taskLoader` (yargs +
command-group.json) e exercita o fluxo completo de agente.
