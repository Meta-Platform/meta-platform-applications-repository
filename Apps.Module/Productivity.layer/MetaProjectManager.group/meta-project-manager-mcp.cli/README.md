# meta-project-manager-mcp.cli

Servidor **MCP (Model Context Protocol)** por **stdio** do Meta Project Manager.
Permite que agentes de IA (Claude Code, Codex, OpenCode…) operem projetos,
boards, tarefas, comentários e anexos **nativamente por tools MCP** — em vez de
(ou além de) chamar a CLI `mpm`.

> **Tipo de pacote:** `.cli`. A plataforma não tem um tipo `.mcp` (extensões
> válidas: `app|cli|webapp|desktopapp|webgui|webservice|service|lib`); um servidor
> MCP stdio é, mecanicamente, um **executável de command-group** — igual ao
> `instance-manager-daemon.cli`. O executável instalado chama-se
> `meta-project-manager-mcp`.

É um **adaptador fino** sobre a mesma camada de domínio `@/project-store.lib`
usada pela CLI e pela GUI: as validações, o **gate de aprovação humana** (criação
estrutural **e** remoção), o **soft delete**, as **permissões** e a **auditoria com
diff** vivem na lib. Este pacote só traduz tools MCP ↔ métodos da store.

## Por que hand-rolled (zero dependências)

O protocolo MCP (subconjunto *tools*) é implementado à mão em CommonJS puro
(`src/Server/McpStdioServer.js`). Motivo: o SDK oficial é ESM-only e a Meta
Platform roda CommonJS (`require`). Assim a **única dependência do pacote é
`@/project-store.lib`** (injetada via `bound-params`) — sem libs externas, sem
novas vulnerabilidades.

> **stdout é do protocolo.** Todo log vai para **stderr**. O comando `serve`
> ainda redireciona `console.log` → stderr por segurança, e escreve o JSON-RPC
> direto em `process.stdout.write`.

## Como o agente se identifica (1 servidor = 1 sessão)

Diferente da CLI (flags `--session-*` por comando), aqui a identidade é definida
**uma vez, no startup** do servidor. O ator é **sempre `agent`** — é o que ativa
o gate de aprovação e a atribuição na auditoria. Configure por **variáveis de
ambiente** (recomendado em clientes MCP) ou por argv:

| Env | Argv | Descrição |
|-----|------|-----------|
| `MPM_SESSION_PROVIDER` | `--session-provider` | claude \| codex \| chatgpt \| other |
| `MPM_SESSION_MODEL`    | `--session-model`    | modelo em uso |
| `MPM_SESSION_TRACE`    | `--session-trace`    | id da sessão (gerado se ausente) |
| `MPM_SESSION_OBJECTIVE`| `--session-objective`| objetivo da sessão (opcional) |

Host, usuário do SO, PID, diretório e git (repo/branch/commit) são capturados
automaticamente.

## Configuração no cliente MCP (ex.: Claude Code)

O executável é instalado em `~/EcosystemData/executables/meta-project-manager-mcp`.
Aponte o cliente para ele passando o subcomando `serve`:

```json
{
  "mcpServers": {
    "meta-project-manager": {
      "command": "meta-project-manager-mcp",
      "args": ["serve"],
      "env": {
        "MPM_SESSION_PROVIDER": "claude",
        "MPM_SESSION_MODEL": "claude-opus-4",
        "MPM_SESSION_TRACE": "sessao-123"
      }
    }
  }
}
```

Garanta o executável no `PATH` da sessão (ou use o caminho completo).

## Orientação do agente (`instructions` + `get_guidance`)

O servidor devolve, no `InitializeResult` do MCP, o campo **`instructions`** — um
guia operacional que o cliente injeta no contexto do agente. É o que faz o agente
já chegar sabendo as regras, em vez de descobri-las errando (batendo no gate,
escrevendo descrições enormes, usando relações de vínculo inexistentes).

Fonte única: `src/Server/Instructions.js`. Também é devolvido pela tool
**`get_guidance`**, para clientes que ignoram `instructions`.

O guia cobre:

| Tema | O que o agente aprende |
|---|---|
| Investigar antes de criar | `search_items`, `get_activity_context` — atualizar em vez de duplicar |
| Ler antes de agir | `get_item` + `list_comments`; comentários de **feedback** são instruções diretas |
| Como escrever | título imperativo curto; `shortDescription` de 1 linha; `description` em seções, sem despejo de logs |
| Livre × sob gate | itens/status/comentários são livres; **criar** projeto/board/milestone/sprint e **remover** projeto/board/item exigem aprovação humana |
| Aprovar é humano | não existem tools de aprovar/rejeitar/confirmar — não tente burlar |
| Armadilhas | relações exatas (`blocks`, `depends`, `relates`, `duplicates`, `implements`, `tests`); `assign_item_planning` é o que vincula milestone/sprint; `keyPrefix` ≤ 5 chars; `file://` vale em link |
| Códigos de erro | o que fazer em `AGENT_SESSION_CONFIRMATION_REQUIRED`, `REJECTED_BY_HUMAN`, `APPROVAL_TIMEOUT`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT` |

> **Ao editar `Instructions.js`:** só documente o que o código realmente faz. Os
> testes (`test/tools.test.js`) verificam que as restrições anunciadas batem com
> o domínio — por exemplo, que as relações de vínculo listadas são as reais.

## Tools expostas

**Planejar (gate — exige aprovação humana):** `create_project`, `create_board`,
`create_milestone`, `create_sprint`. Retornam
`{ ok:false, code:"AGENT_SESSION_CONFIRMATION_REQUIRED", details:{ pendingCreationId } }`
— avise o humano e aguarde `mpm agent creation approve <id>`. `create_project`/`create_board`
aceitam `shortDescription` (resumo `<=240` chars, usado em cards/listas/busca).

**Remover (gate destrutivo — SOFT delete + espera):** `delete_project`, `delete_board`,
`delete_item`. Cada tool cria um pedido destrutivo e, por padrão (`waitApproval:true`),
**BLOQUEIA** aguardando a decisão humana; aprovado ⇒ executa um **SOFT delete** (`deletedAt`,
reversível) e retorna o resultado; rejeitado/timeout ⇒
`{ ok:false, code:"REJECTED_BY_HUMAN" | "APPROVAL_TIMEOUT" | "APPROVAL_EXECUTION_FAILED" }`.
`waitApproval:false` retorna o `approvalRequestId` sem esperar; `approvalTimeoutSeconds` limita
a espera. A interface humana mostra **O QUE** será removido (impacto em cascata) e **QUEM**
pediu (provider/modelo/sessão). Não tente burlar o gate.

**Executar (livre):** `create_item`, `add_to_inbox`, `list_items`, `get_item`,
`update_item`, `set_item_status`, `assign_item`, `move_item_to_board`,
`block_item`, `link_item`, `assign_item_planning`.

**Interagir:** `add_comment`, `list_comments`, `add_link_attachment`,
`add_file_attachment`.

**Anotar contexto:** `add_activity_note` (anotação num escopo
`project|board|sprint|milestone|item`, distinta de `add_comment`), `list_activity_notes`
(lê anotações do escopo — inclusive as do `usuario-desktop`), `get_activity_context`
(notas humanas recentes + auditoria recente, para se situar antes de agir).

**Acompanhar:** `list_projects`, `get_project`, `list_boards`, `project_status`,
`roadmap`, `list_activity`, `list_audit_events`, `get_audit_event`.

**Auditoria:** `list_activity` / `list_audit_events` filtram por ação, `actorType`, `source`,
`provider`, `model` e período; `get_audit_event` traz o diff **antes→depois**. Consulta
**GLOBAL** (sem `project`) exige a permissão `activity:read:all_projects` — sem ela retorna
`FORBIDDEN`. Informe um `project` ou peça a permissão a um humano.

**Descobrir / decidir:** `search_items` (busca em TODOS os projetos),
`list_milestones`, `list_sprints`, `report_blocked`, `report_overdue` — para
decidir entre criar novo e atualizar existente e ver conflitos.

> Aprovar/rejeitar pedidos e confirmar sessões **não** são tools MCP: são ações
> **humanas** (na GUI ou pela CLI `mpm`) — se o agente pudesse se autoaprovar, o gate
> não teria sentido. A **deleção** é exposta, mas **sempre** sob gate e como soft delete.

## Instalar / atualizar (provisionamento local)

```bash
repo install ApplicationsRepository LOCAL_FS --executables meta-project-manager-mcp
# após editar o código:
repo update ApplicationsRepository
```

> **Aqueça o ambiente após (re)instalar.** No **primeiro run**, a plataforma
> constrói o ambiente e instala as dependências, emitindo logs em **stdout** —
> o que corromperia o handshake MCP do cliente nessa primeira vez. Rode uma vez
> para "aquecer" (`echo | meta-project-manager-mcp serve`); os runs seguintes
> têm stdout limpo (só o protocolo). O ambiente fica cacheado por hash de
> metadados, então edições de código não re-disparam o build.

## Estrutura

```
metadata/{package.json, boot.json, command-group.json, startup-params.json}
src/
  Commands/Serve.command.js     # entry persistente (await new Promise(()=>{}))
  Server/McpStdioServer.js       # protocolo MCP stdio (JSON-RPC 2.0), zero deps
  Server/Tools.js                # catálogo de tools → métodos da store
  Utils/{runtime,actor,logger}.js
```
