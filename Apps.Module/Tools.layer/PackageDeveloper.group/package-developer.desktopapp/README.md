# Package Developer (Desktop)

Versão **desktop** do Package Developer: roda a mesma aplicação web do
[`package-developer.webapp`](../package-developer.webapp) dentro de uma janela
[Electron](https://www.electronjs.org/), sem depender do navegador.

É um package do tipo [`.desktopapp`](https://github.com/Meta-Platform/meta-platform-open-standard/blob/main/concepts/package.md).
O `metadata/boot.json` combina:

- a **composição do webapp** (`services` + `endpoints`): sobe um `@@/server-service`
  HTTP e monta o `server-manager.webservice`, o `package-developer.webservice` e o
  `package-developer.webgui` (que é compilado em runtime e servido);
- uma seção **`windows`**: abre uma janela Electron com
  `loadURL(http://localhost:{{port}}/)` apontando para esse servidor local.

A janela só abre depois que o `@@/server-service` está `ACTIVE` (via
`agentLinkRules` gerado a partir do `bound-param` `serverService`). O object loader
`desktop-window-instance` faz `spawn` do Electron.

> Diferente do `package-developer.webapp` (que você abre no navegador), esta versão
> encapsula a mesma interface e o mesmo backend local em uma janela nativa. Roda
> na porta `8094` por padrão (o webapp usa `8093`).
