
const DataSourcesController = (params: any) => {

    const { dataSourceLocalService } = params

    const _Status = () => dataSourceLocalService
        .GetSources()
        .map((source: any) => ({
            type:source.controllerName,
            ...source.GetInfo()
        }))

    const _ListDataSources = () => dataSourceLocalService
        .GetSources()
        .map((source: any) => source.GetInfo())

    const _ListDataSourcesByType = (type: any) =>
        _ListDataSources()
        .filter((source: any) => source.type === type)

    const _GetDataSource = (name: any) => dataSourceLocalService
        .GetSources()
        .find((source: any) => source.GetName() === name)
        .GetInfo()

    // Cria uma fonte relational-database (foco SQLite) em runtime e persiste.
    // Para SQLite basta { name, dialect:"sqlite", storage:"/caminho/arquivo.sqlite" };
    // para rede: { name, dialect, host, port, database, username, password }.
    const _CreateORM = ({ name, dialect, storage, host, port, database, username, password }: any) => {
        const sourceParams = dialect === "sqlite"
            ? { name, dialect, storage }
            : { name, dialect, host, port, database, username, password }
        return dataSourceLocalService.CreateORMSource(sourceParams)
    }

    const _RemoveSource = (keystone: any) => dataSourceLocalService.RemoveSource(keystone)

    const controllerServiceObject = {
        controllerName: "DataSourcesController",
        Status: _Status,
        ListDataSources: _ListDataSources,
        ListDataSourcesByType: _ListDataSourcesByType,
        GetDataSource: _GetDataSource,
        CreateORM: _CreateORM,
        RemoveSource: _RemoveSource
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = DataSourcesController
