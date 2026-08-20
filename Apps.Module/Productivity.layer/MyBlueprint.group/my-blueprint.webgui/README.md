# my-blueprint.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/my-blueprint.webgui`
- **Localização:** `Apps.Module/Productivity.layer/MyBlueprint.group/my-blueprint.webgui` (ApplicationsRepo)

## Propósito

A **interface do My Blueprint**: captura, edição, pesquisa, tags, prioridade,
quadro de status e arquivamento — e a tela onde as propostas do assistente são
revistas antes de virarem alteração.

## Execução

Não roda de forma independente: é compilada em tempo de execução quando o
[`my-blueprint.desktopapp`](../my-blueprint.desktopapp/README.md) sobe.

## Dependências (`metadata/boot.json` → bound-params)

| Bound-param | Namespace |
|---|---|
| `serverService` | `@@/server-service` |
| `iComponents` | `@/i-components.uilib` (kit de UI, no ecosystem-core) |

> Veja o [README do grupo](../README.md).
