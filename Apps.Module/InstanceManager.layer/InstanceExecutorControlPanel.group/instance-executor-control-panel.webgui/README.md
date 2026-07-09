# instance-executor-control-panel.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/instance-executor-control-panel.webgui`
- **Localização:** `Apps.Module/InstanceManager.layer/InstanceExecutorControlPanel.group/instance-executor-control-panel.webgui` (ApplicationsRepository)

## Propósito

Front-end (React/TSX) do **painel do executor de instâncias**. Compõe, com o
`.webservice` e o `.webapp` do grupo [InstanceExecutorControlPanel](../), a
aplicação `executor-panel`. É o painel que **executa** pacotes e observa o que
está rodando — o Ecosystem Control Panel administra o ecossistema e não executa.

## Menus

| menu | container | papel |
|---|---|---|
| `monitor` (inicial) | `TaskMonitor.container` | monitor de processos do ecossistema: tarefas do daemon em tabela densa ordenável ou em árvore pai→filho, com filtro por estado e kill (individual ou em lote) |
| `launcher` | `Launcher.container` | repositórios + árvore `module → layer → group → package` + detalhe com execução (startup params, dependências, terminal para pacotes CLI) |
| `instances` | `ControlPanel.container` | aplicações e serviços já em serviço, supervisionados pelo daemon |
| `terminal` | `Terminal.container` | executa um pacote CLI por caminho digitado |

`launcher` unifica os antigos menus `packages` e `repositories`; URLs antigas
(`?panel=packages`, `?panel=repositories`, `?panel=environments`,
`?panel=task executor monitor`) continuam funcionando via alias.

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
