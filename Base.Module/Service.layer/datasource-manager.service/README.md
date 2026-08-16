# datasource-manager.service

- **Tipo:** pacote de serviços (`.service`)
- **Namespace:** `@/datasource-manager.service`
- **Localização:** `Base.Module/Service.layer/datasource-manager.service` (PlatformApplicationsRepo)

## Propósito

Camada de acesso a fontes de dados: conexão Sequelize, definição e sincronização
de modelos, associação de tabelas e uma alternativa em sistema de arquivos.

**Não confunda com o grupo `Apps.Module/Admin.layer/DataSource.group`**, que é a
*aplicação* Datasource Manager (workbench de bases). Este pacote é a base
reutilizável em `Base.Module`; a aplicação é quem tem GUI, webservice e
desktopapp.

## Serviços expostos (`metadata/services.json`)

| Namespace | Path | Dependências (bound-params) |
|---|---|---|
| `DataSourceLocalManager` | `Managers/DataSourceLocal` | — |

Parâmetro: `appDataDir` — onde as fontes de dados locais são persistidas.

## Exports (`src/`)

| Módulo | Responsabilidade |
|---|---|
| `Managers/DataSourceLocal.ts` | Manager das fontes de dados locais (o serviço publicado). |
| `Managers/DataSourceRelationalDB.ts` | Manager de bases relacionais. |
| `Services/ORM.service.ts` | Serviço Sequelize: dialeto, `storage` e a `connection`. |
| `Services/DataStore.service.ts` | Serviço de armazenamento de dados. |
| `Services/FS.service.ts` | Fonte de dados em sistema de arquivos. |
| `Functions/GetConnection.ts` | Obtém a conexão da instância Sequelize. |
| `Functions/DefineAllModels.ts` · `AssociateAllTables.ts` | Define os modelos e associa as tabelas. |
| `Functions/SyncAllModels.ts` · `SyncDB.ts` | Sincroniza modelos e banco. |
| `Functions/SowJsonData.ts` | Semeia dados a partir de JSON. |

> Veja o [README do repositório](../../../README.md).
