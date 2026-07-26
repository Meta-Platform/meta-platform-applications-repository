# MetaCloud.webgui

- **Tipo:** interface web (`.webgui`)

## Propósito

Esboço da interface web do **MetaCloud**. Hoje existem apenas duas telas —
`Login` e `WelcomePanel` — e nenhum fluxo real por trás delas.

## Execução

Não é executada de forma independente: um `.webgui` é compilado em runtime pelo
loader `web-graphic-user-interface`. **Este pacote ainda não roda**: sem
`metadata/`, não há `boot.json` nem `endpoint-group.json` para o loader montar.

## Estrutura (`src/`)

| Diretório | Conteúdo |
|---|---|
| `Pages/` | `Login.tsx` e `WelcomePanel.tsx`. |

## Pendência conhecida

O pacote **não tem `metadata/package.json`**: não declara namespace, não é
carregável por `@/`, não é indexado pelo catálogo do ecossistema e não aparece
no site de documentação. É um stub — antes de evoluir a interface, ele precisa
dos metadados de um `.webgui`.

> Veja o [README do repositório](../../../../README.md).
