const EcosystemManagerController = (params) => {

    const { 
        ecosystemManagerService,
        repositoryManagerService,
    } = params

    const PackageList = (ws) => {
        ecosystemManagerService.GetTaskExecutorEventEmitter()
        .on("TASK_STATUS_CHANGE", async ({ taskId, status }) => {
            try{
                const packages = await ecosystemManagerService.ListSupervisedPackages()
                ws.send(JSON.stringify(packages))
            }catch(e){
                console.log(e)
            }
        })
    }

    const RunPackage = async ({
        namespaceRepo,
        moduleName,
        layerName,
        packageName,
        ext,
        parentGroup,
        startupParams
    }) => {

        try{
            const packagePath = await repositoryManagerService
            .GetPackagePath({
                namespaceRepo,
                moduleName,
                layerName,
                packageName,
                ext,
                ...parentGroup ? {parentGroup} : {}
            })
            ecosystemManagerService.RunPackage({ packagePath, startupParams })
        } catch(e){
            console.log(e)
        }
    }

    const controllerServiceObject = {
        controllerName : "EcosystemManagerController",
        RunPackage,
        ListPackages: ecosystemManagerService.ListSupervisedPackages,
        PackageList
    }

    return Object.freeze(controllerServiceObject)
}


module.exports = EcosystemManagerController