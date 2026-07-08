# instance-executor-control-panel.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/instance-executor-control-panel.webgui`
- **Localização:** `Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webgui` (ApplicationsRepository)

## Propósito

Front-end (React/TSX) do **painel do executor de instâncias**. Compõe, com o
`.webservice` e o `.webapp` do grupo [InstanceExecutorControlPanel](../), a
aplicação `executor-panel` — usada para visualizar e controlar tarefas,
ambientes e execuções do *task executor*.

## Estrutura (`src/`)

`Pages/`, `Containers/`, `Components/`, `Modals/`, `Hooks/`, `Actions/`,
`Reducers/`, `Mappers/`, `Utils/`, `index.tsx`/`index.html`,
`routes.config.json`.

## Boot (`metadata/boot.json`)

Sobe um `@@/server-service` (`@/server-manager.service`) e expõe seu
`endpoint-group` próprio, montando também o `@/server-manager.webservice`.
Parâmetros: `port`, `serverName`, `serverManagerUrl`,
`RT_ENV_GENERATED_DIR_NAME`, `isWatch`.

> Veja o [README do repositório](../../../../README.md).
