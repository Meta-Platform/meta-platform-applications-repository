# UI Catalog

Aplicativo no padrão Storybook para navegar pelo conjunto completo de WebGui
do Application Repository e pelas coleções de componentes comuns/específicas.
O catálogo agrega histórias publicadas pelos pacotes `.uilib`; a
hierarquia lateral preserva a origem de cada componente.

O pacote pode ser hospedado tanto pelo `ui-catalog.desktopapp` quanto por um
host web que consuma `metadata/endpoint-group.json`. Nos dois modos, os aliases
`@i-components` e `@instance-components` são resolvidos pelas bibliotecas
declaradas no grafo de execução.
