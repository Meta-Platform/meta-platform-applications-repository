# Padrão de aplicativos desktop WebGui

Os aplicativos desktop do Application Repository seguem uma única composição:

1. `*.desktopapp` inicia o `gui-host` e declara seus serviços.
2. `*.webgui` contém somente telas e fluxos próprios do produto.
3. `@/i-components.uilib` fornece tokens, temas, CSS, primitivas e estado
   comuns.
4. Uma biblioteca de módulo, como
   `@/instance-manager.uilib`, contém apenas componentes exclusivos da
   área.
5. O `UI Catalog` documenta as bibliotecas e mantém uma entrada navegável para
   cada WebGui do repositório.

## Estrutura de um novo aplicativo

```text
Feature.group/
├── feature.desktopapp/
│   └── metadata/boot.json
├── feature.webapp/            # opcional, para execução no navegador
│   └── metadata/boot.json
├── feature.webgui/
│   ├── metadata/endpoint-group.json
│   └── src/
└── feature.uilib/       # somente quando há UI exclusiva reutilizável
    ├── metadata/webgui-library.json
    └── src/catalog/stories.tsx
```

Importe o padrão visual uma única vez no entrypoint:

```ts
import "@i-components/styles/index.css"
import { applySavedTheme } from "@i-components/theme"

applySavedTheme()
```

Não copie `tokens.css`, temas, reducers ou actions de infraestrutura para o
novo WebGui. Componentes usados por mais de um módulo sobem para
`i-components.uilib`; componentes usados por vários aplicativos do mesmo
módulo ficam na `.uilib` desse módulo.

## Critério para o catálogo

Cada `.uilib` publica histórias executáveis. Cada WebGui possui uma
coleção própria no catálogo para inventário e navegação. Componentes que exigem
serviços reais devem receber fixtures na biblioteca, sem importar containers do
aplicativo.
