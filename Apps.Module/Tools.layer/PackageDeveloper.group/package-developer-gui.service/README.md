# package-developer-gui.service

Serviço especializado em **servir a GUI** (`package-developer.webgui`) da aplicação
Electron **sem webservices HTTP** (modo *GUI-host* — ver `desktop-window-instance.lib`).

**Compõe** os 7 controllers já existentes do `package-developer.webservice`
(ModuleDeveloper, WebappExplorer, WebguiExplorer, WebserviceExplorer,
LibraryExplorer, FileSystemNavigator, PackageTasks), requeridos via o handle do
pacote. **Não duplica lógica** — a webservice segue como fonte única (dual-transport).

Expõe `Invoke` (contrato HTTP 0/1/2+), `InvokeStream` (contrato WS — o endpoint
**Console** do PackageTasks é um terminal ao vivo com stdin, `ws.send` /
`ws.on("message")` / `ws.on("close")`), `GetManifest` (api.json inteiro) e
`GetIcon` (ModuleDeveloper.GetIcon → `metaicon://`).

Bound-params: `packageHandlerManagerService`, `processManagerService` (services),
`packageDeveloperLib`, `packageToolkitLib`, `packageDeveloperWebservice` (handles).
