# instance-executor-control-panel-gui.service

Serviço especializado em **servir a GUI** (`instance-executor-control-panel.webgui`)
da aplicação Electron **sem webservices HTTP** (modo *GUI-host* — ver
`desktop-window-instance.lib`).

**Compõe** os 3 controllers já existentes do
`instance-executor-control-panel.webservice` (TaskExecutorMonitor,
RepositoryManager, EcosystemManager), requeridos via o handle do pacote. **Não
duplica lógica** — a webservice segue como fonte única (dual-transport).

Expõe:
- `Invoke(serviceName, method, data)` — request/response; espelha o contrato HTTP
  (0 → `method()`; 1 → `method(valor)`; 2+ → `method(objeto)`).
- `InvokeStream(serviceName, method, data, wsShim)` — **streaming** (WebSocket):
  recebe do host um objeto ws-like (mesma API do `ws` do express-ws) e o entrega
  ao método WS do controller (TaskExecutorMonitor: `MonitoringState`/`TaskList`;
  EcosystemManager: `PackageList`). Espelha o contrato WS
  (0 → `method(ws)`; 1 → `method(ws, valor)`; 2+ → `method(ws, objeto)`).
- `GetManifest()` — `{ apiName: apiTemplate }` (o `.api.json` inteiro; o renderer
  reconstrói a superfície e distingue WS de HTTP).
- `GetIcon({ kind, args })` — caminho de arquivo do ícone (`package`), servido pelo
  protocolo `metaicon://`.

Bound-params: `taskExecutorMachineService`, `repositoryManagerService`,
`ecosystemManagerService`, `instanceExecutorControlPanelWebservice` (handle).
