
const getRootService = (listService: any, name: any) => listService
.find(({constructor}: any) => constructor.name === name)

class PackageNavigatorController {

serviceRootList: any

constructor({serviceRootList}: any){
    this.serviceRootList = serviceRootList
}

getPackageManager = () => 
    getRootService(this.serviceRootList, "PackageHandlerManager")

    ListModules = ({workspace, packageName}: any) => {

    }

    GetModule = ({workspace, packageName, module}: any) => {

    }

    GetItemCollections = ({workspace, packageName, module}: any) => {

    }

    GetListItems = ({workspace, packageName, module, endpointName}: any) => {

    }

    GetItem = ({workspace, packageName, module, endpointName, item}: any) => {

    }

}

module.exports = PackageNavigatorController