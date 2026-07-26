# datasource-manager.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/datasource-manager.webgui`
- **Localização:** `Apps.Module/Admin.layer/DataSource.group/datasource-manager.webgui` (PlatformApplicationsRepo)

## Propósito

Front-end (React/TSX) do **Datasource Manager** — o workbench de bases de dados
compatíveis com Sequelize, com foco em SQLite: conectar em um arquivo `.sqlite`
existente, navegar pelas tabelas, consultar e modificar dados e estrutura.

Segue o design system retro-brutalist dos demais aplicativos do ecossistema.

## Execução

Não é executada de forma independente: é compilada em runtime pelo loader
`web-graphic-user-interface`, quando o `datasource-manager.webapp` (web) ou o
`datasource-manager.desktopapp` (Electron) sobe.

## Estrutura (`src/`)

| Diretório | Conteúdo |
|---|---|
| `Pages/` | `Main.page.tsx` — o workbench; `Status.container.tsx` — estado da conexão. |
| `Containers/` | `App.container.tsx` — shell da aplicação. |
| `Components/` | Árvore de conexões e tabelas, grade de dados e editor de SQL. |
| `Actions/` · `Reducers/` · `Mappers/` | Fluxo de estado e adaptação dos dados da API. |
| `Styles/` · `Utils/` · `types.ts` | Tema, utilitários e tipos compartilhados. |
| `routes.config.json` | Rotas da interface. |

## Boot (`metadata/boot.json`)

Parâmetros: `port`, `serverName`, `serverManagerUrl`.

> Veja o [README do repositório](../../../../README.md).
