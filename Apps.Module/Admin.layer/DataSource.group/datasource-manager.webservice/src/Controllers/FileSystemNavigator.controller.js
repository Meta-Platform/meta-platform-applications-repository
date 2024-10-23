
const FileSystemNavigatorController = (params) => {

    const { dataSourceLocalService } = params

    const _ListItem = ({keystone, path}) => dataSourceLocalService
        .GetFSSourceByKeystone(keystone)
        .ListItem(path)

    const _GetContentItem = ({keystone, path}) => dataSourceLocalService
        .GetFSSourceByKeystone(keystone)
        .GetContentItem(path)
    
    const controllerServiceObject = {
        controllerName : "FileSystemNavigatorController",
        ListItem       : _ListItem,
        GetContentItem : _GetContentItem
    }

    return Object.freeze(controllerServiceObject)
}

module.exports = FileSystemNavigatorController