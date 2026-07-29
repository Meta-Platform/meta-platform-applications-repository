# iComponents

Biblioteca comum de interface do Application Repository. Este pacote substitui
o antigo `ui-components.lib` e é carregado como `.icomponents` pelo task loader
do Ecosystem Core.

Os WebGui importam `@i-components`, `@i-components/theme` e
`@i-components/styles/index.css`. O manifesto em
`metadata/webgui-library.json` mantém o binding independente da tecnologia:
outros repositórios podem publicar pacotes `.icomponents` com outro
`framework` e outro adaptador de build.

O catálogo de histórias vive em `src/catalog/stories.tsx` e é consumido pelo
aplicativo `ui-catalog.webgui`.
