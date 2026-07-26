# launcher-gui.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/launcher-gui.service`
- **Localização:** `Apps.Module/InstanceManager.layer/Launcher.group/launcher-gui.service` (PlatformApplicationsRepo)

## Propósito

Serve a GUI do **Launcher** (`launcher.webgui`) dentro do Electron, no modo
*GUI-host*: sem webservice HTTP e sem porta TCP.

**Compõe** os controllers já existentes do `launcher.webservice`
(RepositoryManager, EcosystemManager, CommandLineRuntime), requeridos pelo
handle do pacote. **Não duplica lógica** — a webservice segue como fonte única,
e o transporte é o que muda entre desktop e web.

A interface exposta ao processo principal do Electron é:

- `Invoke(serviceName, method, data)` — request/response, espelhando o contrato HTTP (0 argumentos → `method()`; 1 → `method(valor)`; 2+ → `method(objeto)`).
- `InvokeStream(serviceName, method, data, wsShim)` — streaming: recebe do host um objeto ws-like (mesma API do `ws` do express-ws) e o entrega ao método WS do controller.
- `GetManifest()` — devolve `{ apiName: apiTemplate }` com o `.api.json` inteiro, para o renderer reconstruir a superfície e distinguir WS de HTTP.
- `GetIcon({ kind, args })` — caminho do arquivo de ícone, servido pelo protocolo `metaicon://`.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (bound-params) |
|---|---|---|
| `LauncherGuiService` | `Services/LauncherGui.service` | `repositoryManagerService`, `commandLineRuntimeService`, `instanceManagerRuntimeService`, `launcherWebservice` |

> Veja o [README do repositório](../../../../README.md).
