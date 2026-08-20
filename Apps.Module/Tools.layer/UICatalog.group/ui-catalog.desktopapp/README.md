# ui-catalog.desktopapp

- **Tipo:** aplicação desktop (`.desktopapp`)
- **Namespace:** `@/ui-catalog.desktopapp`
- **Localização:** `Apps.Module/Tools.layer/UICatalog.group/ui-catalog.desktopapp` (ApplicationsRepo)

## Propósito

A janela que hospeda o **catálogo de componentes** da plataforma: mostra cada
componente do kit de UI com suas variações, para que se veja o que já existe
antes de escrever um novo.

## Como está montado

Sobe o servidor HTTP local, monta a
[`@/ui-catalog.webgui`](../ui-catalog.webgui/README.md) e abre a janela apontando
para ela. Os componentes exibidos vêm da `@/i-components.uilib`, no
ecosystem-core.

## Execução

Lance pelo Instance Executor, como as demais aplicações desktop.

> Veja o [README do grupo](../README.md).
