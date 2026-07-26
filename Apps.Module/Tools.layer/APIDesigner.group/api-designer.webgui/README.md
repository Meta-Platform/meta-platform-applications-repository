# api-designer.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/api-designer.webgui`
- **Localização:** `Apps.Module/Tools.layer/APIDesigner.group/api-designer.webgui` (PlatformApplicationsRepo)

## Propósito

Front-end (React/TSX) do **API Designer** — a ferramenta de autoria dos
`APIs/*.api.json` dos pacotes `.webservice`: definir controllers, endpoints,
métodos e parâmetros sem editar o JSON à mão.

É um dos pacotes do grupo `APIDesigner.group`, junto com o `.webservice`
(backend), o `-gui.service`, o `.webapp` (composição web) e o `.desktopapp`
(janela Electron).

## Execução

Não é executada de forma independente: é compilada em runtime pelo loader
`web-graphic-user-interface`, quando o `api-designer.webapp` (web) ou o
`api-designer.desktopapp` (Electron) sobe.

## Estrutura (`src/`)

| Diretório | Conteúdo |
|---|---|
| `Pages/` · `Containers/` | Páginas do designer e shell da aplicação. |
| `Forms/` · `Columns/` · `Lists/` | Formulários de endpoint e parâmetro, colunas e listas do catálogo de APIs. |
| `Components/` | Componentes de tela. |
| `Actions/` · `Reducers/` · `Mappers/` | Fluxo de estado e adaptação dos dados da API. |
| `ErrorBoundary.tsx` · `Utils/` | Tratamento de erro e utilitários. |
| `routes.config.json` | Rotas da interface. |

> Veja o [README do repositório](../../../../README.md).
