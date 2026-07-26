# MetaCloud.webapp

- **Tipo:** composição web (`.webapp`)

## Propósito

Composição prevista para o **MetaCloud**: subiria o `MetaCloud.webgui` sobre um
`@@/server-service`. Hoje o diretório contém apenas o `package.json`.

## Execução

**Este pacote ainda não roda.** Um `.webapp` é inteiramente definido pelo seu
`metadata/boot.json` — e ele não existe aqui.

## Composição (`metadata/boot.json`)

Não declarada.

## Pendência conhecida

Sem `metadata/package.json` e sem `metadata/boot.json`, o pacote não declara
namespace, não é carregável por `@/`, não é indexado pelo catálogo do
ecossistema e não aparece no site de documentação. É um stub, assim como o
`MetaCloud.webgui`.

> Veja o [README do repositório](../../../../README.md).
