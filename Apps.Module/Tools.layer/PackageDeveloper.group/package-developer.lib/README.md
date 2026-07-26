# package-developer.lib

- **Tipo:** biblioteca (`.lib`)
- **Namespace:** `@/package-developer.lib`
- **Localização:** `Apps.Module/Tools.layer/PackageDeveloper.group/package-developer.lib` (PlatformApplicationsRepo)

## Propósito

Biblioteca de leitura da estrutura de repositórios e pacotes que sustenta o
**Package Developer**.

Sua característica distintiva é operar sobre um **caminho absoluto** de
repositório, e não sobre os repositórios *instalados*: enquanto a
`@/repository-utilities.lib` enumera pacotes a partir do `repositories.json` do
`EcosystemData`, esta lib varre o diretório que você apontar. É o que permite ao
IDE abrir um repositório que ainda não foi instalado no ecossistema.

Além de enumerar, ela lê os metadados de um pacote e verifica se ele cumpre o
contrato de arquivos do seu tipo.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `Manager.Functions/` | `GetRepositoryHierarchy.function.js` varre um repositório por caminho absoluto e devolve `módulos → camadas → grupos → pacotes`, com o namespace de cada um. |
| `Managers/PackageHandler` | Manager exposto como serviço: workspaces, pacotes e seus metadados. |
| `Package.Functions/` | Operações sobre um pacote individual. |
| `Services/PackageHandler.service/` | Metadados, detalhes, ícone e verificações de um pacote. |
| `Services/{Library,Webgui,Webservice,Webapp}.service/` | Contrato de arquivos esperados por tipo de pacote (`Configs/requirements.config.js`). |
| `Services/{APIs,Boot,Controllers,Git,Managers,Routes,Services}.service.js` | Leitura das partes de um pacote: APIs, boot, controllers, status git, managers, rotas e serviços. |

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (bound-params) |
|---|---|---|
| `PackageHandlerManager` | `Managers/PackageHandler` | `workspaceStoreLib` |

Parâmetro: `workspaceStorageFilePath`.

> Veja o [README do repositório](../../../../README.md).
