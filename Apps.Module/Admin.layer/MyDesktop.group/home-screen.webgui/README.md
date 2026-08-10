# home-screen.webgui

- **Tipo:** interface web (`.webgui`)
- **Namespace:** `@/home-screen.webgui`
- **Localização:** `Apps.Module/Admin.layer/MyDesktop.group/home-screen.webgui` (PlatformApplicationsRepo)

## Propósito

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

Monta a interface sobre o **UI kit** `@i-components` (o `.uilib` do ecosystem
core): tokens, temas e componentes vêm de `@i-components/styles/index.css` e de
`@i-components`. Nenhum componente de terceiro é importado direto — em especial,
**nada de `semantic-ui-react`** (o kit é quem o encapsula). Os cinco temas
(light/dark/gray/blue/cyberpunk) são trocáveis pelo menu de sistema e persistem
em `localStorage` (`@i-components/theme`).

Em `src/Styles/desktop.css` fica **só o que é exclusivo de uma área de
trabalho** — janela com "traffic lights", grade de ícones arrastáveis, dock,
barra de sistema com relógio, popover de aplicativos —, todo prefixado `.myd-*`
e 100% sobre os tokens `--mp-*`, sem cor crua e sem valor de reserva. Botão,
campo, busca, chip, menu, spinner e popover são do kit.

## Estrutura

- `src/Pages/Desktop.page.tsx` — página raiz (injeta o catálogo de servidores).
- `src/Containers/Desktop.container.tsx` — orquestra busca, seleção, tema,
  boas-vindas e lançamento.
- `src/Components/` — `SystemMenuBar`, `DesktopIcon`, `Dock`, `Window` (chrome
  retrô reutilizável) e `WelcomeWindow`.
- `src/Utils/GetApplicationIconURL.ts` — monta a URL do ícone servido pelo backend.
