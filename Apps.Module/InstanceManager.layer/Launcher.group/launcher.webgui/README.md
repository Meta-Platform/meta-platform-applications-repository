# launcher.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/launcher.webgui`
- **Localização:** `Apps.Module/InstanceManager.layer/Launcher.group/launcher.webgui` (PlatformApplicationsRepo)

## Propósito

Front-end (React/TSX) do **Launcher** — a interface por onde se **lança** um
pacote do ecossistema: navegar pelos repositórios instalados, abrir a árvore
`module → layer → group → package`, inspecionar um pacote e executá-lo.

O Launcher nasceu dentro do `InstanceExecutorControlPanel.group` e foi extraído
para uma aplicação própria: o painel de instâncias ficou só com o
**monitoramento** do que já está no ar, e o ato de **lançar** passou a viver
aqui. São responsabilidades distintas e agora são aplicações distintas.

Para pacotes `.cli`, a aba de comandos monta o formulário de execução a partir
do `command-group.json` do próprio pacote — os metadados chegam inteiros ao
navegador, então não é preciso um endpoint por comando.

## Execução

Não é executada de forma independente: é compilada em runtime pelo loader
`web-graphic-user-interface`, quando o `launcher.webapp` (web) ou o
`launcher.desktopapp` (Electron, modo GUI-host) sobe.

## Estrutura (`src/`)

| Diretório | Conteúdo |
|---|---|
| `Pages/` | `ControlPanel.page.tsx` — a página do Launcher. |
| `Containers/` | `App.container.tsx` e `Launcher.container` — estado e composição da tela. |
| `Components/` · `Modals/` | Árvore de pacotes, formulário de comandos e diálogos. |
| `Actions/` · `Reducers/` · `Hooks/` | Fluxo de estado da aplicação. |
| `Mappers/` · `Utils/` · `Styles/` | Adaptação dos dados da API, utilitários e tema. |
| `routes.config.json` | Rotas da interface. |

## Boot (`metadata/boot.json`)

Sobe um `@@/server-service` (`@/server-manager.service/services/HTTPServerService`)
e monta o endpoint group do `@/server-manager.webservice` mais o seu próprio.
Parâmetros: `port`, `serverName`, `serverManagerUrl`, `isWatch`.

> Veja o [README do repositório](../../../../README.md).
