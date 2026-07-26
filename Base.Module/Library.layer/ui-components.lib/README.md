# ui-components.lib

- **Tipo:** biblioteca (`.lib`)

## Propósito

Componentes React compartilhados entre as interfaces do repositório: a barra de
título (`HeadBar`) e o terminal (`Terminal`), mais os utilitários de requisição
que eles usam.

## Execução

Não é executada de forma independente: é importada pelo código das `.webgui`
que a consomem, e compilada junto com elas.

## Estrutura

| Diretório | Conteúdo |
|---|---|
| `Components/` | `HeadBar.component.tsx` e `Terminal.component.tsx`. |
| `Containers/` · `Modals/` · `Hooks/` | Composição, diálogos e estado local dos componentes. |
| `Actions/` · `Reducers/` | Fluxo de estado. |
| `Utils/` | `GetRequest.util.ts` e `GetRequestByServer.ts`. |
| `Styles/Global.style.ts` · `Assets/` | Estilo global e recursos. |

## Pendência conhecida

Este pacote **não tem `metadata/package.json`** e, por isso, não declara
namespace: não é carregável por `@/ui-components.lib`, não é indexado pelo
catálogo de pacotes do ecossistema e o código também não vive em `src/`, como
manda a convenção. Enquanto isso não for resolvido, ele é um diretório com
sufixo `.lib` — não um pacote da plataforma.

> Veja o [README do repositório](../../../README.md).
