# my-workspace.webgui

Workspace pessoal do usuário do MyDesktop: um **quadro de notas** (sticky notes)
persistido localmente. Primeira versão do app que antes era um stub vazio.

Reutiliza **verbatim** o design system "Meta System Retro-Brutalist UI" do
`home-screen.webgui` (tokens, temas, `theme.ts`) — os cinco temas são trocáveis
pela barra superior e persistem em `localStorage`. O estilo específico do quadro
está em `src/Styles/workspace.css`, todo baseado nos tokens `--mp-*`.

## Funcionalidades
- Criar, editar (título + corpo) e excluir notas.
- Trocar a cor da nota (ciclo de cores do tema).
- Persistência automática em `localStorage` (`myworkspace-notes`).

## Execução
Não é executada de forma independente. É compilada em runtime (loader
`web-graphic-user-interface`) e servida sobre um `@@/server-service` a partir do
`metadata/endpoint-group.json`. O `metadata/boot.json` permite subir standalone
para testes (porta `8892`).

> Roadmap: integrar o workspace ao MyDesktop (abrir como janela) e evoluir de
> notas para um verdadeiro workspace de arquivos/atalhos do usuário.
