# Known Issues — Applications Repository

Itens confirmados no código (estrutura de diretórios atual).

## 1. Packages stub / em desenvolvimento

O grupo `MyDesktop` já está implementado — `my-desktop.desktopapp`,
`home-screen.webgui` e `execution-manager.webservice` (a pasta usa a grafia
correta `execution-manager`, não `mananger`). Segue **stub** apenas o
`my-workspace.webgui` (vazio). No grupo `MetaCloud`, o `MetaCloud.webapp` é stub
(só `package.json`) e o `MetaCloud.webgui` tem apenas telas iniciais. Ver a
matriz de estado no [README](../README.md#matriz-de-packages); packages stub não
devem ser tratados como funcionais.

## 2. `ui-components.lib` sem `metadata/`

A `Base.Module/Library.layer/ui-components.lib` é uma biblioteca de componentes
React consumida em **build** pelos `webgui`; **não** possui `metadata/package.json`
(namespace de plataforma) e, portanto, não é resolvida como package em runtime.
Isso é intencional, mas a diferença em relação a uma `.lib` de plataforma deve
ficar clara.
