
const getRootService = (listService, name) => listService
.find(({constructor}) => constructor.name === name)

class PackageNavigatorController {

constructor({serviceRootList}){
    this.serviceRootList = serviceRootList
}

getPackageManager = () => 
    getRootService(this.serviceRootList, "PackageHandlerManager")

    ListModules = ({workspace, packageName}) => {

    }

    GetModule = ({workspace, packageName, module}) => {

    }

    GetItemCollections = ({workspace, packageName, module}) => {

    }

    GetListItems = ({workspace, packageName, module, endpointName}) => {

    }

    GetItem = ({workspace, packageName, module, endpointName, item}) => {

    }

}

module.exports = PackageNavigatorController