# desktop-gui.service

Serviço especializado em **servir a GUI** (`home-screen.webgui`) das aplicações
Electron **sem webservices HTTP**.

No modo *GUI-host* (ver `desktop-window-instance.lib`), o processo principal do
Electron instancia este serviço e o expõe ao renderer por IPC
(`window.metaGui.invoke(serviceName, method, args)` / `getManifest()`), no lugar
de subir um servidor HTTP + controllers REST.

## Sem duplicação de lógica

Este serviço **compõe** os controllers já existentes do
`execution-manager.webservice` — `DesktopApplications`, `Execution`,
`Applications` — requeridos via o handle do pacote
(`executionManagerWebservice.require(...)`). A lógica de negócio permanece única
nesses controllers, que continuam sendo servidos por HTTP no caminho navegador
(dual-transport). Os arquivos `APIs/*.api.json` da webservice são reusados como
**manifesto**: as chaves `summary` de cada endpoint viram os nomes de método
expostos ao renderer, idênticos aos que o `GetRequestByServer` do webgui produz
no HTTP.

## API exposta

- `Invoke(serviceName, method, args)` — encaminha para `registry[serviceName][method](args)`.
- `GetManifest()` — `{ DesktopApplications:[...], Execution:[...], Applications:[...] }`.
- `GetIcon({ kind, args })` — caminho de arquivo do ícone (`kind`: `desktop` | `managed`); usado pelo protocolo `metaicon://`.

## Bound-params (mesmo saco da webservice)

`ecosystemdataHandlerService`, `notificationHubService`, `repositoryManagerService`,
`jsonFileUtilitiesLib`, `ecosystemInstallUtilitiesLib`, `executionManagerWebservice`
(handle) + param `ecosystemDefaultsFileRelativePath`.
