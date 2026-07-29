# Relatório de refatoração WebGui e iComponents

Data da medição: 29 de julho de 2026.

## Resultado

Os nove WebGui existentes passaram de **526 para 367 arquivos-fonte**, de
**65.321 para 47.253 linhas** e de **2.778.725 para 2.125.270 bytes**.
Isso representa:

- **159 arquivos removidos dos consumidores (30,2%)**;
- **18.068 linhas removidas dos consumidores (27,7%)**;
- **653.455 bytes removidos dos consumidores (23,5%)**.

Mesmo contabilizando de volta as duas novas bibliotecas compartilhadas e o
catálogo, a superfície de UI ficou em **413 arquivos, 51.925 linhas e
2.299.902 bytes**: redução líquida de **113 arquivos (21,5%)**, **13.396 linhas
(20,5%)** e **478.823 bytes (17,2%)**.

## Comparação por WebGui

| WebGui | Arquivos antes → depois | Linhas antes → depois | Bytes antes → depois |
|---|---:|---:|---:|
| Datasource Manager | 40 → 22 | 3.503 → 1.534 | 138.208 → 65.463 |
| Home Screen | 44 → 26 | 6.252 → 3.945 | 253.751 → 171.242 |
| My Workspace | 30 → 12 | 2.822 → 515 | 103.811 → 21.302 |
| Instance Executor | 68 → 31 | 10.035 → 6.215 | 375.979 → 237.494 |
| Launcher | 53 → 22 | 5.473 → 2.139 | 208.073 → 87.452 |
| Meta Project Manager | 144 → 126 | 20.776 → 18.447 | 1.003.373 → 919.921 |
| API Designer | 24 → 17 | 1.154 → 1.043 | 35.051 → 32.138 |
| Meta Cloud | 2 → 2 | 0 → 0 | 0 → 0 |
| Package Developer | 121 → 109 | 15.306 → 13.415 | 660.479 → 590.258 |

## Código compartilhado criado

| Pacote | Arquivos | Linhas | Bytes |
|---|---:|---:|---:|
| `i-components.icomponents` | 24 | 2.433 | 87.249 |
| `instance-manager.icomponents` | 18 | 2.089 | 78.747 |
| `ui-catalog.webgui` | 4 | 150 | 8.636 |

A antiga `ui-components.lib` foi aproveitada: virou
`i-components.icomponents`, recebeu o novo contrato de manifesto e concentrou
estado, tema, tokens, CSS e primitivas. Componentes e assets antigos que não
eram importados nem compilados foram removidos, junto com dependências órfãs
como `xterm`, `axios` e `query-string`.

O Instance Executor e o Launcher agora compartilham componentes e CSS próprios
da área por `instance-manager.icomponents`. Os demais WebGui reutilizam a
biblioteca Base para reducers, actions, tema e estilos.

## Infraestrutura

- O Core reconhece `.icomponents` como tipo de pacote suportado.
- O Essential escolhe `webgui-library` no grafo de execução pelo namespace.
- O novo task loader publica um handle independente de framework.
- O WebInterfaceBuilder resolve aliases, dependências e tipos das bibliotecas.
- Hosts web e desktop transportam `componentLibraries`.
- O cache desktop inclui fontes compartilhadas no fingerprint.

## Catálogo e padrão

O `ui-catalog.desktopapp` abre um catálogo no padrão Storybook, com busca e
navegação hierárquica. Ele agrega histórias reais da biblioteca comum e da
biblioteca do Instance Manager e mantém uma coleção específica para cada um dos
nove WebGui preexistentes.

O padrão para novos desktops e a regra de promoção de componentes estão em
`docs/desktop-webgui-standard.md`. O contrato reutilizável entre tecnologias
está documentado no Core em `docs/webgui-component-libraries.md`.

## Verificação

- TypeScript sem erros nas duas bibliotecas, no catálogo e nos oito WebGui com
  fontes TypeScript.
- Bundle real do catálogo: 753 módulos e 4.652.578 bytes em modo development.
- Revalidação independente após a limpeza final: 686 módulos, zero warnings,
  zero erros e bundle de 5.334.609 bytes em modo development.
- Meta Project Manager: **9 suítes / 40 testes aprovados**.
- Package Developer: **12 suítes / 135 testes aprovados**.
- `webgui-library.taskLoader`: **2 testes aprovados**.
- Sintaxe JavaScript validada nos loaders, builder e integração desktop.
- Todos os arquivos JSON alterados foram validados.

## Metodologia

A linha de base foi capturada antes da refatoração. A medição considera
arquivos `.ts`, `.tsx` e `.css` dentro de `src`, excluindo `node_modules`.
“Consumidores” são os nove WebGui já existentes. A “superfície líquida de UI”
soma esses consumidores, as duas `.icomponents` e o novo catálogo; o código de
infraestrutura do Core/Essential/task loader não entra nessa comparação para
não misturar capacidade nova com a redução do frontend.
