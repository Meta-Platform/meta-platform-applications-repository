# execution-manager.webservice

Web service (backend) do **MyDesktop** (`home-screen.webgui`). Responsável por
descobrir as aplicações de desktop instaladas no ecossistema e por lançá-las.

## Execução

Não é executado de forma independente (`node index.js`). É montado em runtime
sobre um `@@/server-service` a partir do `metadata/endpoint-group.json`, quando o
`my-desktop.desktopapp` (ou o `boot.json` deste pacote, para testes isolados) é
executado pelo Package Executor.

Depende dos serviços de core do ecossistema, injetados por `bound-params`:
`repositoryManagerService` (varredura/resolução de pacotes e ícones),
`ecosystemdataHandlerService` (caminho do EcosystemData), `jsonFileUtilitiesLib`
e `notificationHubService`.

## Serviços disponibilizados

### **Desktop Applications** [DesktopApplications]
Base: `/desktop-applications`

#### **List Desktop Applications** [ListDesktopApplications]
`GET` /desktop-applications/list

Lista apenas as aplicações **instaladas** cujo `appType === "DESKTOP"`. Cada item
traz os dados da aplicação e um objeto `packageData` com a identidade do pacote
(`namespaceRepo`, `moduleName`, `layerName`, `parentGroup?`, `packageName`, `ext`)
e `hasPackageIcon`.

#### **Get Application Icon** [GetApplicationIcon]
`GET` /desktop-applications/icon

Serve o arquivo de ícone do pacote (resposta do tipo `file`).

**Parâmetros**
| Name | Value Type | Parameter Type | Required |
| ---- | ---------- | -------------- | -------- |
| namespaceRepo | string | query | yes |
| moduleName    | string | query | yes |
| layerName     | string | query | yes |
| packageName   | string | query | yes |
| ext           | string | query | yes |
| parentGroup   | string | query | no  |

### **Applications** [Applications]
Base: `/applications` — gerenciamento de pacotes (todos os tipos: DESKTOP/APP/CLI).

#### **List Applications** [ListApplications]
`GET` /applications/list

Lista todas as aplicações **declaradas** pelos repositórios instalados
(`metadata/applications.json`), cada uma com `isInstalled` (se o executável já
existe), `appType`, `repositoryNamespace` e `hasPackageIcon`.

#### **Get Application Icon** [GetApplicationIcon]
`GET` /applications/icon?executableName=… — serve o ícone (resposta `file`).

#### **Install Application** [InstallApplication]
`POST` /applications/install — body `{ executableName }`. Instala o executável
declarado (via `InstallApplication` da `ecosystem-install-utilities.lib`).

#### **Uninstall Application** [UninstallApplication]
`POST` /applications/uninstall — body `{ executableName }`. Remove o executável
(apaga `<exec>`/`<exec>-dbg` e tira de `installedApplications`), via a nova
primitiva `UninstallApplication` da `ecosystem-install-utilities.lib`.

#### **Update All Repositories** [UpdateAllRepositories]
`POST` /applications/update-all — atualiza todos os repositórios ativos
(reinstala os apps já instalados de cada um). Retorna `{ results: [...] }`.

### **Execution** [Execution]
Base: `/execution`

#### **Run Application** [RunApplication]
`POST` /execution/run-application

Lança a aplicação de desktop. O cliente envia a **identidade** do pacote; o
caminho absoluto é resolvido no backend (`repositoryManagerService.GetPackagePath`)
e o pacote é iniciado de forma desacoplada via `run package <path>`.

**Parâmetros**
| Name | Value Type | Parameter Type | Required |
| ---- | ---------- | -------------- | -------- |
| namespaceRepo | string | body | yes |
| moduleName    | string | body | yes |
| layerName     | string | body | yes |
| packageName   | string | body | yes |
| ext           | string | body | yes |
| parentGroup   | string | body | no  |
