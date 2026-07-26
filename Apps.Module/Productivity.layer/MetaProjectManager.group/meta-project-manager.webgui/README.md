# meta-project-manager.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/meta-project-manager.webgui`
- **Localização:** `Apps.Module/Productivity.layer/MetaProjectManager.group/meta-project-manager.webgui` (PlatformApplicationsRepo)

## Propósito

Front-end (React/TSX) do **Meta Project Manager** — a aplicação de gestão de
projetos do ecossistema, usada tanto por pessoas quanto por agentes de IA (estes
pelo `meta-project-manager-mcp.cli`).

Cobre o ciclo inteiro de um projeto: ideias, planejamento (entregas, sprints,
charter, cronograma), execução (board, lista, backlog), acompanhamento
(relatórios, riscos, auditoria) e documentação (wiki de páginas com anexos).
As telas de agentes e feedback são o que dá ao humano o controle sobre o que a
IA faz: aprovação de criações estruturais, gate para iniciar e concluir tarefas
e uma fila de feedback que o agente é obrigado a consultar.

## Execução

Não é executada de forma independente: é compilada em runtime pelo loader
`web-graphic-user-interface`, quando o `meta-project-manager.webapp` (web) ou o
`meta-project-manager.desktopapp` (Electron) sobe.

## Estrutura (`src/`)

| Diretório | Conteúdo |
|---|---|
| `Pages/` | Uma página por área: `Home`, `Project`, `Board`, `List`, `Backlog`, `Inbox`, `Roadmap`, `Gantt`, `PlanningDocs`, `Docs`, `Reports`, `Risks`, `Audit`, `Agents`, `AgentGuide`, `Feedback`, `Users`, `Glossary`, `Archive`. |
| `Containers/` | `App.container.tsx` — shell da aplicação (sidebar duplo e header). |
| `Domain/` | Modelo de domínio no cliente (itens, tipos, status). |
| `api/` | Cliente da API do `meta-project-manager.webservice`. |
| `Components/` · `Modals/` · `Hooks/` | Componentes de tela, diálogos e estado local. |
| `Actions/` · `Reducers/` · `Mappers/` | Fluxo de estado e adaptação dos dados da API. |
| `Styles/` · `Utils/` | Tema e utilitários. |
| `routes.config.json` | Rotas — a view corrente vem da URL. |

## Boot (`metadata/boot.json`)

Parâmetros: `port`, `serverName`, `serverManagerUrl`, `isWatch`.

> Veja o [README do repositório](../../../../README.md).
