# Data Source Manager (Desktop)

Versão **desktop** do Data Source Manager: roda a mesma aplicação web do
[`datasource-manager.webapp`](../datasource-manager.webapp) dentro de uma janela
[Electron](https://www.electronjs.org/), sem depender do navegador.

É um package do tipo [`.desktopapp`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/package.md).
O `metadata/boot.json` combina:

- a **composição do webapp** (`services` + `endpoints`): sobe um `@@/server-service`
  HTTP e monta o `server-manager.webservice`, o `datasource-manager.webservice` e o
  `datasource-manager.webgui` (que é compilado em runtime e servido);
- uma seção **`windows`**: abre uma janela Electron com
  `loadURL(http://localhost:{{port}}/)` apontando para esse servidor local.

A janela só abre depois que o `@@/server-service` está `ACTIVE` (via
`agentLinkRules` gerado a partir do `bound-param` `serverService`). O object loader
`desktop-window-instance` faz `spawn` do Electron.

> Diferente do `datasource-manager.webapp` (que você abre no navegador), esta versão
> encapsula a mesma interface e o mesmo backend local em uma janela nativa. Roda
> na porta `9249` por padrão (o webapp usa `9248`).
