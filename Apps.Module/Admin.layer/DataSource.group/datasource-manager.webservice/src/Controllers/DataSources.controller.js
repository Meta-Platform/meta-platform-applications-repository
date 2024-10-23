
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

    const controllerServiceObject = {
        controllerName: "DataSourcesController",
        Status: _Status,
        ListDataSources: _ListDataSources,
        ListDataSourcesByType: _ListDataSourcesByType,
        GetDataSource: _GetDataSource
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = DataSourcesController