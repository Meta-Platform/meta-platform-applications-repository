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
- Erros com **códigos estáveis**: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`,
  `CONFIRMATION_REQUIRED`, `FORBIDDEN`, `AGENT_SESSION_CONFIRMATION_REQUIRED`.

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

## Grupos de comandos

`project` · `board` (+`column`) · `story|task|subtask` · `item` (create/list/show/update/
set-status/assign/move/move-to-board/reorder/convert/block/link/unlink/delete/checklist-add/
acceptance-add) · `attachment` · `comment` · `user` · `agent` (+`session`) · `report` ·
`activity` · `export` · `import`.

Veja a árvore completa em `metadata/command-group.json`. Rode `mpm <grupo> --help`.

## Testes

```bash
npm install yargs --no-save   # a plataforma provê yargs em produção; necessário só p/ o harness
node --test
```
O harness (`test/cli.harness.js`) replica o `CommandApplication.taskLoader` (yargs +
command-group.json) e exercita o fluxo completo de agente.
