# Known Issues — Applications Repository

Itens confirmados no código.

## 1. Pacotes stub

`MetaCloud.webapp` tem apenas `package.json`, e `MetaCloud.webgui` tem apenas
telas iniciais. **Nenhum dos dois tem `metadata/package.json`**, então não têm
namespace e não são carregáveis por `@/`.

Pacote stub não deve ser tratado como funcional.
