# meta-project-manager-mcp.cli

- **Tipo:** aplicação de linha de comando (`.cli`)
- **Namespace:** `@/meta-project-manager-mcp.cli`
- **Executável:** `meta-project-manager-mcp`
- **Localização:** `Apps.Module/Productivity.layer/MetaProjectManager.group/meta-project-manager-mcp.cli` (PlatformApplicationsRepo)

## Propósito

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

### Aparecer no Instance Executor Manager (recomendado)

Do jeito acima, quem sobe o processo é o cliente de IA — o daemon de execução
nunca soube dele, então o servidor **não aparece no monitor** e não há como
saber se o que está no ar é a versão mais nova. O wrapper `executor attach`
resolve isso: registra a execução no daemon (versão do pacote, origem do
binário, branch/commit, início) e só então executa o MCP, herdando stdio.

```json
{
  "mcpServers": {
    "meta-project-manager": {
      "command": "executor",
      "args": [
        "attach",
        "~/EcosystemData/repos/PlatformApplicationsRepo/Apps.Module/Productivity.layer/MetaProjectManager.group/meta-project-manager-mcp.cli",
        "--",
        "meta-project-manager-mcp",
        "serve"
      ]
    }
  }
}
```

O primeiro argumento depois de `attach` é o **pacote** que está sendo executado
(é dele que saem versão e commit); tudo depois de `--` é o comando real.

- O daemon **não passa a controlar** o processo: encerrar continua sendo de quem
  o iniciou. No painel a instância aparece com o selo **externa**.
- Daemon fora do ar **não impede** o MCP de subir — o attach degrada com um aviso
  no stderr.
- Ao encerrar a sessão, o registro sai do monitor (e, se o processo morrer sem
  avisar, o daemon o limpa pelo pid).

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

**Planejar:** `create_project` e `create_board` são **gated** (exigem aprovação
humana) e retornam
`{ ok:false, code:"AGENT_SESSION_CONFIRMATION_REQUIRED", details:{ pendingCreationId } }`
— avise o humano e aguarde `mpm agent creation approve <id>`. `create_milestone` e
`create_sprint` são **livres** (planejamento é reversível). A lista viva do que é
gated sai de `get_guidance().constraints.gatedActions`, **derivada** de
`Config.AGENT_GATE_POLICY` — a mesma que o store consulta ao decidir se bloqueia.
Todas essas tools aceitam `shortDescription` (resumo `<=240` chars, usado em
cards/listas/busca), assim como `create_item`.

**Remover (gate destrutivo — SOFT delete + espera):** `delete_project`, `delete_board`,
`delete_item`. Cada tool cria um pedido destrutivo e, por padrão (`waitApproval:true`),
**BLOQUEIA** aguardando a decisão humana; aprovado ⇒ executa um **SOFT delete** (`deletedAt`,
reversível) e retorna o resultado; rejeitado/timeout ⇒
`{ ok:false, code:"REJECTED_BY_HUMAN" | "APPROVAL_TIMEOUT" | "APPROVAL_EXECUTION_FAILED" }`.
`waitApproval:false` retorna o `approvalRequestId` sem esperar; `approvalTimeoutSeconds` limita
a espera. A interface humana mostra **O QUE** será removido (impacto em cascata) e **QUEM**
pediu (provider/modelo/sessão). Não tente burlar o gate.

**Executar (livre):** `create_item`, `add_to_inbox`, `list_items`, `get_item`,
`update_item`, `assign_item`, `move_item_to_board`, `block_item`, `link_item`,
`assign_item_planning`. `set_item_status` também é livre, **exceto** iniciar
(`in-progress`) e concluir (`done`/`completed`/coluna de conclusão): aí passa
pelo mesmo gate das tools acima — BLOQUEIA até a decisão humana e retorna o item
já no novo status (ou `REJECTED_BY_HUMAN`), com `waitApproval`/`approvalTimeoutSeconds`.

O gate é da **mudança de status**, não da tool: `update_item({ status })` e
`set_items_status` (lote) passam pela mesma regra — não há caminho lateral.
Ao concluir, o retorno traz **`unmetAcceptanceCriteria`** (a definição de pronto
que ainda não foi marcada), e o pedido de aprovação leva essa lista para a tela
do humano. Uma aprovação **tardia** que não faz mais sentido é recusada com
`STALE_APPROVAL` em vez de reverter o estado atual do item.

**Em lote:** `create_items` (N itens; `ref`/`parent:"@apelido"` montam a
hierarquia dentro do próprio lote), `link_items` (N vínculos),
`add_acceptance_criteria` com `texts`, `update_acceptance_criteria` com lista de
ids (ou `updates:[{criteria,met}]`) e `set_items_status` — que pede **uma**
aprovação para o conjunto em vez de N diálogos idênticos. Cada elemento volta como
`{ index, ok, key | error }` — uma falha isolada não invalida o lote. `create_item`
também aceita `acceptanceCriteria` para criar a Definition of Done junto.

**Classificar (campo, não markdown):** `labels` (livres e filtráveis),
`area` (adota a grafia já usada no projeto), `effort` (`xs…xl`, somado por
entrega), `confidence` (`low|medium|high`) e `value`. O vocabulário em uso sai de
`list_labels` e `list_areas`; os filtros correspondentes existem em `list_items`
e `search_items`.

**Rastrear risco e sequência:** `link_risk_item` / `unlink_risk_item` ligam um
risco ao trabalho que o mitiga ou o dispara (`get_item` passa a mostrar os riscos,
`get_risk` os itens); `link_milestones` / `unlink_milestones` declaram dependência
entre entregas (`depends`/`blocks`, ciclo recusado), o que reordena o `roadmap`
topologicamente e alimenta `dependenciesMet`.

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
`list_milestones`, `list_sprints`, `report_blocked`, `report_overdue`,
`report_ready` (o que está desimpedido, ordenado por quanto cada item destrava) e
`ecosystem_index_status` (estado do catálogo de pacotes, sem escrever nada).

**Coordenar com os outros agentes:** vários trabalham no mesmo workspace — e no
mesmo checkout — ao mesmo tempo.

| Tool | Para quê |
|---|---|
| `who_is_here` | quem está trabalhando AGORA: sessões vivas, itens e **pacotes** reivindicados, foco atual e último progresso |
| `next_task` | pega a próxima tarefa desimpedida **e já reivindica**, numa chamada (sem a corrida entre ler a fila e reivindicar) |
| `claim_item` / `release_item` | dono declarado do item; `packages` avisa quem já está naquele pacote |
| `report_progress` | heartbeat: renova a reivindicação e atualiza o foco visível da sessão |
| `send_agent_message` | recado **dirigido** a outra sessão (por `toSession` ou pelo `item` que ela reivindicou) |
| `agent_inbox` | relê os avisos recebidos |
| `update_session_focus` | muda objetivo/foco sem tocar na identidade (que fica auditada) |
| `record_environment_action` / `list_environment_actions` | quem subiu/derrubou/reprovisionou o quê |
| `end_session` | sai limpo: libera os itens na hora e anuncia a saída |

**A fila é limpa:** item com reivindicação **viva de outra sessão** não aparece em
`list_items`, `search_items` nem `report_ready` — `includeClaimed:true` mostra o
quadro completo, e aí cada item traz `claim`. Item pedido para `in-progress` e
ainda não aprovado carrega `pendingStatusKey`, para o board não mentir enquanto a
aprovação não vem.

**Presença**: uma sessão é `here`, vira `idle` após 15 min sem ação e `gone` após
60 min — a passagem para `gone` **anuncia a saída**, que é o caso de quem morre
sem se despedir.

### Contrato de retorno

| Forma | Regra |
|---|---|
| Escrita | devolve **resumo** (id/key + o que mudou). `view:"full"` traz o registro inteiro |
| Listagem | envelope `{ items, total, limit, offset, returned, hasMore }`, sem textos longos; `fields` projeta colunas |
| Lote | `{ total, succeeded, failed, results:[{ index, ok, … }] }` |
| Estouro | a resposta **degrada** (campos longos fora, lista cortada) e carrega `_truncated` explicando — a tool não falha |
| Avisos | quando há novidade entre sessões (entrou/saiu alguém, recado dirigido, ambiente), o envelope ganha `_notices` **fora de `data`** — inclusive nas respostas de erro |

```jsonc
{
  "ok": true,
  "data": { /* … resposta da tool … */ },
  "_notices": [
    "[entrou] codex/gpt-6 · 3f2a1c04 · migrar loaders",
    "[msg de 3f2a1c04] varri um arquivo teu para o meu commit"
  ]
}
```

> O aviso é **entregue**, não consultado: o agente que precisa da informação é
> justamente o que não sabe que precisa perguntar.

O teto vive em `Server/ResponseGuard.js` e vale para **toda** tool, inclusive as
que forem adicionadas depois; os envelopes ficam em `Server/Envelopes.js`.

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
  Server/Envelopes.js            # projeção, resumo de escrita e execução em lote
  Server/ResponseGuard.js        # teto de tamanho: degrada em vez de estourar
  Utils/{runtime,actor,logger}.js
```

## Comandos (`metadata/command-group.json`)

| Comando | Descrição |
|---|---|
| `serve` | Servidor MCP (stdio) do Meta Project Manager para agentes de IA |
