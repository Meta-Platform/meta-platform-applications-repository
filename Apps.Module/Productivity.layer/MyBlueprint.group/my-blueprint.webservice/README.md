# my-blueprint.webservice

- **Tipo:** web service (`.webservice`)
- **Namespace:** `@/my-blueprint.webservice`
- **Localização:** `Apps.Module/Productivity.layer/MyBlueprint.group/my-blueprint.webservice` (ApplicationsRepo)

## Propósito

A **API do My Blueprint**: expõe sobre HTTP as operações de itens, configurações
e do assistente, sempre através da [`blueprint-store.lib`](../blueprint-store.lib/README.md).

## Superfície

O `endpoint-group` monta o `Blueprint.controller`, declarado em
`src/APIs/Blueprint.api.json`. A API é publicada **por manifesto**: uma operação
que não esteja declarada ali não existe para o cliente, mesmo implementada.

O assistente devolve alterações como **proposta**: nada é criado, editado ou
arquivado até a confirmação explícita de quem opera.

## Dependências (`metadata/boot.json` → bound-params)

| Bound-param | Namespace |
|---|---|
| `serverService` | `@@/server-service` |
| `blueprintStoreLib` | `@/blueprint-store.lib` |

Parâmetro: `MB_DB_FILE_PATH` — caminho do banco.

> Veja o [README do grupo](../README.md).
