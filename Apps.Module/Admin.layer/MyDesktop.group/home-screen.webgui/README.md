# home-screen.webgui

Interface gráfica (SPA React + TypeScript) do **MyDesktop** — a área de trabalho
e porta de entrada do uso local do ecossistema.

Exibe, como ícones, todas as **aplicações de desktop instaladas** (`appType ===
"DESKTOP"`) e permite lançá-las com um duplo-clique (ou pelo dock inferior).

## Execução

Não é executada de forma independente. É compilada em runtime (loader
`web-graphic-user-interface`) e servida sobre um `@@/server-service` a partir do
`metadata/endpoint-group.json`, quando o `my-desktop.desktopapp` (ou o `boot.json`
deste pacote, para testes isolados) é executado pelo Package Executor.

Consome o `execution-manager.webservice` (irmão):
- `GET /desktop-applications/list` — lista as aplicações instaladas;
- `GET /desktop-applications/icon` — ícone de cada aplicação;
- `POST /execution/run-application` — lança a aplicação.

## Identidade visual

Reutiliza **verbatim** o design system "Meta System Retro-Brutalist UI" do
`ecosystem-control-panel.webgui` (`src/Styles/tokens.css`, `themes.css`,
`theme-retro-brutalist.css`, `CorporateTheme.css`, `components.css` e
`Utils/theme.ts`). Os cinco temas (light/dark/gray/blue/cyberpunk) são trocáveis
pela barra superior e persistem em `localStorage`.

O estilo específico da área de trabalho (janelas com "traffic lights", grade de
ícones, dock e barra de sistema) está em `src/Styles/desktop.css`, todo baseado
nos tokens `--mp-*` — por isso funciona em qualquer tema sem regra extra.

## Estrutura

- `src/Pages/Desktop.page.tsx` — página raiz (injeta o catálogo de servidores).
- `src/Containers/Desktop.container.tsx` — orquestra busca, seleção, tema,
  boas-vindas e lançamento.
- `src/Components/` — `SystemMenuBar`, `DesktopIcon`, `Dock`, `Window` (chrome
  retrô reutilizável) e `WelcomeWindow`.
- `src/Utils/GetApplicationIconURL.ts` — monta a URL do ícone servido pelo backend.
