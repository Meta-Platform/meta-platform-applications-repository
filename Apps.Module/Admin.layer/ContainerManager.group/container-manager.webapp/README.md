# container-manager.webapp

- **Tipo:** aplicação web (`.webapp`)
- **Namespace:** `@/container-manager.webapp`
- **Executável:** `container-manager`

## Propósito

O Container Manager servido pelo navegador. Monta num processo só: o servidor
HTTP, o gerenciador de conexões (`@/container-runtime-adapter.service`, do
Ecosystem Core), a API do aplicativo (`@/container-manager.webservice`) e a
interface (`@/container-manager.webgui`).

## Parâmetros (`metadata/startup-params.json`)

| Parâmetro | O que é |
|-----------|---------|
| `port` | Porta do servidor (padrão `9310`) |
| `serverName` | Nome da instância |
| `appDataDir` | Onde as conexões cadastradas são guardadas |
| `serverManagerUrl` | Endpoint de status usado pela interface no boot |

O `appDataDir` chega ao gerenciador de conexões como `storageDir` — é lá que
nasce o `container-connections.json`.

## Executar

```bash
executor package ~/EcosystemData/repositories/PlatformApplicationsRepo/Apps.Module/Admin.layer/ContainerManager.group/container-manager.webapp
```

Depois, `http://localhost:9310`.
