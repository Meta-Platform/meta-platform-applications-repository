# Known Issues — Applications Repository

Itens confirmados no código (estrutura de diretórios atual).

## 1. Typo no nome da pasta `execution-mananger.webservice`

O package planejado para o gerenciamento de execução está com o nome **grafado
errado**: `Apps.Module/Admin.layer/MyDesktop.group/execution-mananger.webservice`
(deveria ser `execution-manager`). A pasta está **vazia** (stub), então o impacto
atual é nulo, mas o nome deve ser corrigido antes de implementar o package
(e qualquer referência por namespace deverá usar o nome corrigido).

## 2. Packages stub / em desenvolvimento

Vários packages do grupo `MyDesktop` e `MetaCloud` ainda são **stubs** (vazios ou
só com `package.json`) — ver a matriz de estado no
[README](../README.md#matriz-de-packages). Não devem ser tratados como
funcionais.

## 3. `ui-components.lib` sem `metadata/`

A `Base.Module/Library.layer/ui-components.lib` é uma biblioteca de componentes
React consumida em **build** pelos `webgui`; **não** possui `metadata/package.json`
(namespace de plataforma) e, portanto, não é resolvida como package em runtime.
Isso é intencional, mas a diferença em relação a uma `.lib` de plataforma deve
ficar clara.
