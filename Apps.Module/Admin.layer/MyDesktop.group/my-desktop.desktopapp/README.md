# MyDesktop (Desktop)

Versão **desktop** do MyDesktop — a área de trabalho e porta de entrada do uso
local do ecossistema. Roda a mesma aplicação web do `home-screen.webgui` dentro
de uma janela [Electron](https://www.electronjs.org/), sem depender do navegador.

É um package do tipo [`.desktopapp`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/package.md).
O `metadata/boot.json` combina:

- os **serviços de core** necessários (`notification-hub-service`,
  `ecosystemdata-handler-service`, `repository-manager` e um `@@/server-service`
  HTTP);
- a **composição do app** (`endpoints`): monta o `server-manager.webservice`, o
  `execution-manager.webservice` (descoberta e lançamento de apps de desktop) e o
  `home-screen.webgui` (compilado em runtime e servido);
- uma seção **`windows`**: abre uma janela Electron com
  `loadURL(http://localhost:{{port}}/)` apontando para esse servidor local.

A janela só abre depois que o `@@/server-service` está `ACTIVE` (via
`agentLinkRules` gerado a partir do `bound-param` `serverService`), exibindo uma
tela de carregamento até o webgui terminar de compilar. Roda na porta `9257` por
padrão.

## Aplicações exibidas

O MyDesktop mostra as aplicações **instaladas** cujo `appType === "DESKTOP"`
(registro `installedApplications` do EcosystemData). Cada ícone lança o pacote
correspondente via `run package <path>`, abrindo sua própria janela.
