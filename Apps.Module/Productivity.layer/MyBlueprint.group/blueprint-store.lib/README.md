# blueprint-store.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/blueprint-store.lib`
- **Localização:** `Apps.Module/Productivity.layer/MyBlueprint.group/blueprint-store.lib` (ApplicationsRepo)

## Propósito

A **persistência do My Blueprint**: itens (ideias, notas, tarefas), configurações
e trilha de auditoria, num banco SQLite local.

É a única porta para os dados — o webservice e o servidor MCP usam esta lib, e
não o banco diretamente, para que ambos enxerguem as mesmas regras.

## Modelo

| Tabela | Conteúdo |
|---|---|
| `items` | Os itens, com tipo, título, corpo, status, prioridade, tags e origem. |
| `settings` | Configurações do usuário. |
| `audit` | Quem alterou o quê, e por qual origem. |

Vocabulários: **tipo** `idea`, `note`, `task`; **status** `inbox`, `backlog`,
`planned`, `done`, `archived`; **prioridade** de `none` a `critical`.

O campo de origem distingue o que foi criado por uma pessoa do que veio de um
agente — é o que torna a auditoria útil.

## Dependências

Apenas `metadata/package.json` (namespace). Usa `sqlite3` como dependência npm.

> Veja o [README do grupo](../README.md).
