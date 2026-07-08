# meta-project-manager.mcp

Servidor **MCP (Model Context Protocol)** por **stdio** do Meta Project Manager.
Permite que agentes de IA (Claude Code, Codex, OpenCode…) operem projetos,
boards, tarefas, comentários e anexos **nativamente por tools MCP** — em vez de
(ou além de) chamar a CLI `mpm`.

É um **adaptador fino** sobre a mesma camada de domínio `@/project-store.lib`
usada pela CLI e pela GUI: as validações, o **gate de aprovação humana** para
criação estrutural e a **auditoria** vivem na lib. Este pacote só traduz tools
MCP ↔ métodos da store.

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

## Tools expostas

**Planejar (gate — exige aprovação humana):** `create_project`, `create_board`,
`create_milestone`, `create_sprint`. Retornam
`{ ok:false, code:"AGENT_SESSION_CONFIRMATION_REQUIRED", details:{ pendingCreationId } }`
— avise o humano e aguarde `mpm agent creation approve <id>`.

**Executar (livre):** `create_item`, `add_to_inbox`, `list_items`, `get_item`,
`update_item`, `set_item_status`, `assign_item`, `move_item_to_board`,
`block_item`, `link_item`.

**Interagir:** `add_comment`, `list_comments`, `add_link_attachment`,
`add_file_attachment`.

**Acompanhar:** `list_projects`, `get_project`, `list_boards`, `project_status`,
`roadmap`, `list_activity`.

> Aprovar/rejeitar pedidos de criação e confirmar sessões **não** são tools MCP:
> são ações **humanas** (na GUI ou pela CLI `mpm`). Deleção física também fica
> fora do MCP.

## Instalar / atualizar (provisionamento local)

```bash
repo install ApplicationsRepository LOCAL_FS --executables meta-project-manager-mcp
# após editar o código:
repo update ApplicationsRepository
```

## Estrutura

```
metadata/{package.json, boot.json, command-group.json, startup-params.json}
src/
  Commands/Serve.command.js     # entry persistente (await new Promise(()=>{}))
  Server/McpStdioServer.js       # protocolo MCP stdio (JSON-RPC 2.0), zero deps
  Server/Tools.js                # catálogo de tools → métodos da store
  Utils/{runtime,actor,logger}.js
```
