# launcher.webservice

- **Tipo:** serviço web, backend HTTP (`.webservice`)
- **Namespace:** `@/launcher.webservice`
- **Localização:** `Apps.Module/InstanceManager.layer/Launcher.group/launcher.webservice` (PlatformApplicationsRepo)

## Propósito

Backend do **Launcher**. Expõe ao `launcher.webgui` o que é preciso para
navegar pelos repositórios instalados e **executar** um pacote: o catálogo de
repositórios, módulos, camadas e pacotes; o lançamento pelo daemon de execução;
e a execução de aplicações de linha de comando com terminal em streaming.

## Execução

Não é executado de forma independente (`node index.js`). É montado em runtime
sobre um `@@/server-service` a partir do seu
[`metadata/endpoint-group.json`](./metadata/endpoint-group.json), quando o
`launcher.webapp` ou o `launcher.desktopapp` é executado pelo Package Executor.

## Serviços disponibilizados

### **Repository Manager** [RepositoryManager]

`ListRepositories`, `RegisterRepository`, `GetPackagePath`, `ListModules`,
`ListLayers`, `ListPackages`, `GetPackageIcon`, `GetMetadataHierarchy` e
`GetPackageDependencyHierarchy` — o catálogo que alimenta a árvore de pacotes.

### **Ecosystem Manager** [EcosystemManager]

`ListPackages`, `PackageList` (WS), `RunPackage`, `StopPackage` e
`StopInstance` — o lançamento em si, delegado ao daemon de execução. É o
`instanceId`, e não o `packagePath`, que identifica cada execução.

### **Command Line Runtime** [CommandLineRuntime]

`RunPackage`, `List`, `Kill` e `TerminalStream` (WS) — execução de aplicações
`.cli` com terminal interativo.

## Dependências (`metadata/boot.json` → `bound-params`)

- `@/server-manager.service` (`@@/server-service`)
- `@/repository-manager.service` (`@@/repository-manager`)
- `@/command-line-runtime.service` (`@@/command-line-runtime`)
- `@/repository-utilities.lib` e `@/dependency-graph-builder.lib`

> Veja o [README do repositório](../../../../README.md).
