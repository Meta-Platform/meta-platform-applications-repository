# meta-project-manager-gui.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/meta-project-manager-gui.service`
- **Localização:** `Apps.Module/Productivity.layer/MetaProjectManager.group/meta-project-manager-gui.service` (PlatformApplicationsRepo)

## Propósito

Serviço **GUI-host** do Meta Project Manager. No desktop (Electron), o processo principal
instancia este serviço e o expõe ao renderer por IPC (`window.metaGui`) — **sem HTTP**.

Não duplica regra: apenas **compõe os mesmos controllers** do
`@/meta-project-manager.webservice` (fonte única de verdade, sobre `@/project-store.lib`),
que continuam servidos por HTTP no caminho navegador (dual-transport). Molde: `desktop-gui.service`.

- `Invoke(serviceName, method, data)` espelha o contrato do servidor HTTP
  (0 params → `()`, 1 → valor posicional, 2+ → objeto), tornando o IPC um drop-in do webservice.
- `GetManifest()` devolve `{ Api: [summaries...] }` para o webgui montar a mesma superfície de API.
- Realtime no desktop = polling de `Events.GetEvents` via `Invoke` (mesmo caminho do browser).

Injeção (services.json): bound-params `metaProjectManagerWebservice`, `projectStoreLib`;
params `dbFilePath`, `attachmentsDirPath`, `maxAttachmentBytes`. O `AppContext` singleton
do webservice garante **um** store compartilhado entre todos os controllers.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (bound-params) |
|---|---|---|
| `MetaProjectManagerGuiService` | `Services/MetaProjectManagerGui.service` | `metaProjectManagerWebservice`, `projectStoreLib` |
