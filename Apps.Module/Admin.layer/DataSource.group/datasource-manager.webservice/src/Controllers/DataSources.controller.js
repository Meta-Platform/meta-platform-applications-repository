
const DataSourcesController = (params) => {

    const { dataSourceLocalService } = params

    const _Status = () => dataSourceLocalService
        .GetSources()
        .map(source => ({
            type:source.controllerName,
            ...source.GetInfo()
        }))

    const _ListDataSources = () => dataSourceLocalService
        .GetSources()
        .map(source => source.GetInfo())

    const _ListDataSourcesByType = (type) =>
        _ListDataSources()
        .filter((source) => source.type === type)

    const _GetDataSource = (name) => dataSourceLocalService
        .GetSources()
        .find(source => source.GetName() === name)
        .GetInfo()

    // Cria uma fonte relational-database (foco SQLite) em runtime e persiste.
    // Para SQLite basta { name, dialect:"sqlite", storage:"/caminho/arquivo.sqlite" };
    // para rede: { name, dialect, host, port, database, username, password }.
    const _CreateORM = ({ name, dialect, storage, host, port, database, username, password }) => {
        const sourceParams = dialect === "sqlite"
            ? { name, dialect, storage }
            : { name, dialect, host, port, database, username, password }
        return dataSourceLocalService.CreateORMSource(sourceParams)
    }

    const _RemoveSource = (keystone) => dataSourceLocalService.RemoveSource(keystone)

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
