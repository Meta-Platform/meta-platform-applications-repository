# package-developer.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/package-developer.webgui`
- **Localização:** `Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.webgui` (PlatformApplicationsRepo)

## Propósito

Front-end (React/TSX) do **Package Developer** — o IDE de pacotes da plataforma:
navegar pela hierarquia `repositório → módulo → camada → grupo → pacote`, ler e
editar os arquivos de um pacote, ver seus metadados e acompanhar o status git da
árvore (o não-commitado aparece em vermelho).

A aba **README** de um pacote é renderizada aqui — ou seja, esta interface é uma
das duas consumidoras do `README.md` padronizado, junto com o site de
documentação.

O layout segue o tema "Classic Technical Workbench".

## Execução

Não é executada de forma independente: é compilada em runtime pelo loader
`web-graphic-user-interface`, quando o `package-developer.webapp` (web) ou o
`package-developer.desktopapp` (Electron) sobe.

## Estrutura (`src/`)

| Diretório | Conteúdo |
|---|---|
| `Pages/` | `Main.page.tsx` — o workbench. |
| `Containers/` | `App.container.tsx` — shell da aplicação. |
| `Layouts/` · `Lists/` · `Items/` | Painéis, listas e itens da árvore de pacotes. |
| `Components/` · `Modals/` · `Hooks/` | Editor, visualizador de metadados, diálogos e estado local. |
| `Actions/` · `Reducers/` · `Mappers/` | Fluxo de estado e adaptação dos dados da API. |
| `Styles/` · `Utils/` · `types.ts` | Tema, utilitários e tipos compartilhados. |
| `Mocks/` | Dados de apoio ao desenvolvimento da interface. |
| `routes.config.json` | Rotas da interface. |

## Boot (`metadata/boot.json`)

Parâmetros: `port`, `serverName`, `serverManagerUrl`.

> Veja o [README do repositório](../../../../README.md).
