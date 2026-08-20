# my-blueprint.desktopapp

- **Tipo:** aplicação desktop (`.desktopapp`)
- **Namespace:** `@/my-blueprint.desktopapp`
- **Executável:** `my-blueprint`
- **Localização:** `Apps.Module/Productivity.layer/MyBlueprint.group/my-blueprint.desktopapp` (ApplicationsRepo)

## Propósito

A **composição** do My Blueprint: sobe o servidor HTTP local, monta a API e a
interface, e abre a janela apontando para elas.

## Como está montado

| Parte | Origem |
|---|---|
| Servidor HTTP | `@/server-manager.service` (ecosystem-core) |
| API | [`@/my-blueprint.webservice`](../my-blueprint.webservice/README.md) |
| Interface | [`@/my-blueprint.webgui`](../my-blueprint.webgui/README.md) |
| Dados | [`@/blueprint-store.lib`](../blueprint-store.lib/README.md) |

A janela só abre quando o servidor está ativo.

## Execução

Lance pelo Instance Executor, como as demais aplicações desktop.

## Parâmetros

`port`, `serverName`, `serverManagerUrl`, `isWatch`, `MB_DB_FILE_PATH` (banco) e
`MB_DESKTOP_URL` (endereço que a janela carrega).

> Veja o [README do grupo](../README.md).
