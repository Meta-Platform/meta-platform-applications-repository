# My Blueprint

Aplicativo desktop local para capturar ideias, organizar notas e transformar
intencoes em backlog. O chat GPT usa uma chave configurada somente pelo usuario;
Claude Code, Codex e OpenCode/GLM acessam os mesmos dados pelo servidor MCP.

Pacotes: `my-blueprint.desktopapp`, `my-blueprint.webgui`,
`my-blueprint.webservice`, `blueprint-store.lib` e `my-blueprint-mcp.cli`.

## Fluxos incluídos

- Captura, edição, pesquisa, tags, prioridade, quadro de status e arquivamento.
- Assistente GPT que devolve alterações como uma proposta: nenhuma nota é criada,
  editada ou arquivada até a confirmação em **Aplicar ações aprovadas**.
- Dados e configurações mantidos localmente no SQLite do My Blueprint.
- Servidor MCP local para Claude Code, Codex e OpenCode/GLM compartilharem o
  mesmo backlog.

## MCP

Depois de provisionar o repositório, use o executável `my-blueprint-mcp` como
um servidor MCP stdio. Ele expõe `list_items`, `get_item`, `create_item`,
`update_item`, `archive_item`, `search_items` e `capture_idea`.

Exemplo de configuração genérica para Claude Code, Codex ou OpenCode:

```json
{
  "mcpServers": {
    "my-blueprint": {
      "command": "my-blueprint-mcp"
    }
  }
}
```

Peça ao agente para confirmar antes de usar `archive_item`; os demais comandos
permitem registrar e organizar ideias diretamente no backlog local.
